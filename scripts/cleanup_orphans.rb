#!/usr/bin/env ruby

require 'optparse'
require 'colorize'
require 'securerandom'
require 'json'
require 'io/console'
require_relative 'lib/db_helper'

class OrphanCleanup
  def initialize(options = {})
    @mode = options[:mode] || 'all'
    @days = options[:days] || 30
    @remote = options[:remote] || false
    @execute = options[:execute] || false
    @delete_r2 = options[:delete_r2] || false
    @verbose = options[:verbose] || false
    @db = remote? ? nil : DbHelper.local_connection
    @orphan_artworks = []
    @orphan_r2_objects = []
  end

  def run
    puts "=== VFA Gallery Orphan Cleanup ===".cyan
    puts "Mode: #{@mode}"
    puts "Days threshold: #{@days}"
    puts "Database: #{@remote ? 'remote' : 'local'}".yellow
    puts "Dry run: #{!@execute}".yellow if !@execute
    puts ""

    case @mode
    when 'db'
      cleanup_db_orphans
    when 'r2'
      cleanup_r2_orphans
    when 'all'
      cleanup_db_orphans
      cleanup_r2_orphans
    else
      raise "Unknown mode: #{@mode}"
    end

    if @execute
      puts "\n✓ Cleanup completed successfully".green
    else
      puts "\n" + "This is a DRY RUN. Use --execute to apply changes.".yellow
    end
  rescue StandardError => e
    puts "\n✗ Error: #{e.message}".red
    exit 1
  end

  private

  def cleanup_db_orphans
    puts "=== DATABASE CLEANUP ===".cyan
    puts "Finding artworks with no collections for #{@days}+ days..."

    find_db_orphans
    preview_db_orphans

    if @orphan_artworks.empty?
      puts "No orphan artworks found.".green
      return
    end

    if @execute
      confirm_execution("database cleanup", @orphan_artworks.length)
      delete_db_orphans
    end
  end

  def cleanup_r2_orphans
    puts "\n=== R2 CLEANUP ===".cyan
    puts "Finding orphan files in R2 bucket..."

    validate_r2_credentials
    find_r2_orphans
    preview_r2_orphans

    if @orphan_r2_objects.empty?
      puts "No orphan R2 objects found.".green
      return
    end

    unless @delete_r2
      puts "\n⚠ WARNING: --delete-r2 flag is required to delete R2 files.".yellow
      puts "Pass --delete-r2 flag to enable R2 deletions.".yellow
      return
    end

    if @execute
      confirm_execution("R2 cleanup", @orphan_r2_objects.length)
      delete_r2_orphans
    end
  end

  def find_db_orphans
    sql = <<~SQL
      SELECT a.id, a.title, a.user_id, u.username, a.original_url, a.created_at, a.updated_at
      FROM artworks a
      LEFT JOIN collection_artworks ca ON a.id = ca.artwork_id
      JOIN users u ON a.user_id = u.id
      WHERE a.status != 'deleted'
        AND ca.artwork_id IS NULL
        AND DATETIME(a.updated_at) < DATETIME('now', '-' || ? || ' days')
      ORDER BY a.updated_at ASC
    SQL

    results = execute_query(sql, [@days])
    @orphan_artworks = results
  end

  def preview_db_orphans
    if @orphan_artworks.empty?
      return
    end

    puts "\n" + "=== PREVIEW (Dry Run) ===".cyan
    puts "The following #{@orphan_artworks.length} orphan artwork(s) would be deleted:\n"

    @orphan_artworks.each_with_index do |artwork, index|
      puts "[#{index + 1}]".cyan
      puts "  ID: #{artwork['id']}"
      puts "  Title: #{artwork['title']}"
      puts "  User: #{artwork['username']} (#{artwork['user_id']})"
      puts "  Updated: #{artwork['updated_at']}"
      puts "  URL: #{artwork['original_url']}"
      puts ""
    end

    puts "Total to delete: #{@orphan_artworks.length}".yellow
  end

  def delete_db_orphans
    puts "\n=== DELETING DATABASE RECORDS ===".cyan
    succeeded = 0
    failed = 0

    @orphan_artworks.each_with_index do |artwork, index|
      begin
        artwork_id = artwork['id']
        user_id = artwork['user_id']

        # Soft delete the artwork
        timestamp = Time.now.iso8601
        sql_update = "UPDATE artworks SET status = 'deleted', updated_at = ? WHERE id = ?"
        execute_update(sql_update, [timestamp, artwork_id])

        # Log the deletion
        activity_id = SecureRandom.uuid
        metadata = {
          reason: "Orphaned artwork - not in any collection for #{@days} days"
        }.to_json

        sql_log = "INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'artwork_orphan_deleted', 'artwork', ?, ?, ?)"
        execute_update(sql_log, [activity_id, user_id, artwork_id, metadata, timestamp])

        puts "✓ [#{index + 1}/#{@orphan_artworks.length}] Deleted: #{artwork['title'][0..40]}".green
        succeeded += 1
      rescue => e
        puts "✗ [#{index + 1}/#{@orphan_artworks.length}] Failed: #{artwork['title'][0..40]} - #{e.message}".red
        failed += 1
      end
    end

    puts "\n" + "=== SUMMARY ===".cyan
    puts "Deleted: #{succeeded}".green
    puts "Failed:  #{failed}".red if failed > 0
  end

  def find_r2_orphans
    require 'aws-sdk-s3'

    s3_client = create_s3_client

    # Get all R2 objects
    puts "Listing all objects in R2 bucket...".yellow if @verbose
    all_keys = []
    marker = nil

    loop do
      response = s3_client.list_objects(
        bucket: r2_bucket_name,
        marker: marker
      )

      all_keys.concat(response.contents.map(&:key)) if response.contents
      break unless response.is_truncated

      marker = response.contents.last.key
    end

    puts "Found #{all_keys.length} objects in R2 bucket".yellow if @verbose

    # Get all referenced URLs from database
    puts "Checking database for referenced URLs...".yellow if @verbose
    referenced_keys = get_referenced_r2_keys

    puts "Found #{referenced_keys.length} referenced R2 keys in database".yellow if @verbose

    # Find orphans
    @orphan_r2_objects = all_keys.reject { |key| referenced_keys.include?(key) || key.start_with?('backups/') }

    puts "Found #{@orphan_r2_objects.length} orphan R2 objects".yellow
  end

  def preview_r2_orphans
    if @orphan_r2_objects.empty?
      return
    end

    puts "\n" + "=== PREVIEW (Dry Run) ===".cyan
    puts "The following #{@orphan_r2_objects.length} orphan R2 object(s) would be deleted:\n"

    @orphan_r2_objects.first(20).each_with_index do |key, index|
      puts "[#{index + 1}] #{key}".yellow
    end

    if @orphan_r2_objects.length > 20
      puts "... and #{@orphan_r2_objects.length - 20} more".yellow
    end

    puts "\nTotal to delete: #{@orphan_r2_objects.length}".yellow
  end

  def delete_r2_orphans
    puts "\n=== DELETING R2 OBJECTS ===".cyan

    require 'aws-sdk-s3'
    s3_client = create_s3_client

    succeeded = 0
    failed = 0

    @orphan_r2_objects.each_with_index do |key, index|
      begin
        s3_client.delete_object(
          bucket: r2_bucket_name,
          key: key
        )

        puts "✓ [#{index + 1}/#{@orphan_r2_objects.length}] Deleted: #{key[0..60]}".green
        succeeded += 1
      rescue => e
        puts "✗ [#{index + 1}/#{@orphan_r2_objects.length}] Failed: #{key[0..60]} - #{e.message}".red
        failed += 1
      end
    end

    puts "\n" + "=== SUMMARY ===".cyan
    puts "Deleted: #{succeeded}".green
    puts "Failed:  #{failed}".red if failed > 0
  end

  def get_referenced_r2_keys
    sql = <<~SQL
      SELECT original_url, display_url, thumbnail_url, icon_url
      FROM artworks
      WHERE status != 'deleted'
        AND (original_url IS NOT NULL OR display_url IS NOT NULL OR thumbnail_url IS NOT NULL OR icon_url IS NOT NULL)
    SQL

    results = execute_query(sql, [])
    keys = Set.new

    results.each do |row|
      [row['original_url'], row['display_url'], row['thumbnail_url'], row['icon_url']].each do |url|
        next if url.nil? || url.empty?

        key = extract_r2_key(url)
        keys.add(key) if key
      end
    end

    keys.to_a
  end

  def extract_r2_key(url)
    # Extract R2 key from full URL
    # URL format: https://{account_id}.r2.cloudflarestorage.com/{key}
    # or: https://{custom_domain}/{key}

    uri = URI.parse(url)
    return nil unless uri

    # Remove leading slash
    path = uri.path.sub(%r{^/}, '')
    path if path && !path.empty?
  rescue URI::InvalidURIError
    nil
  end

  def confirm_execution(action, count)
    puts "\n" + "WARNING: This will #{action} and delete #{count} item(s).".red
    puts "This action cannot be easily undone.\n"
    print "Type 'yes' to confirm: ".yellow
    confirmation = $stdin.gets.chomp

    unless confirmation.downcase == 'yes'
      puts "Cancelled.".yellow
      exit 0
    end
  end

  def execute_query(sql, params = [])
    if remote?
      D1RemoteHelper.execute_query(sql)
    else
      @db.execute(sql, params)
    end
  end

  def execute_update(sql, params = [])
    if remote?
      # Remote requires special handling for parameterized queries
      # For now, this simplified version assumes the query is safe
      D1RemoteHelper.execute_query(sql)
    else
      @db.execute(sql, params)
    end
  end

  def remote?
    @remote
  end

  def validate_r2_credentials
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    missing = required_vars.reject { |var| ENV[var] }

    unless missing.empty?
      raise "Missing R2 credentials: #{missing.join(', ')}"
    end
  end

  def create_s3_client
    require 'aws-sdk-s3'

    Aws::S3::Client.new(
      region: 'auto',
      access_key_id: ENV['R2_ACCESS_KEY_ID'],
      secret_access_key: ENV['R2_SECRET_ACCESS_KEY'],
      endpoint: "https://#{ENV['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    )
  end

  def r2_bucket_name
    ENV['R2_BUCKET_NAME'] || 'vfa-gallery-images'
  end
end

def main
  options = {
    mode: 'all',
    days: 30,
    remote: false,
    execute: false,
    delete_r2: false,
    verbose: false
  }

  OptionParser.new do |opts|
    opts.banner = "Usage: cleanup_orphans.rb [OPTIONS]"

    opts.on('-m', '--mode MODE', %w[db r2 all], 'Cleanup mode: db, r2, or all (default: all)') do |m|
      options[:mode] = m
    end

    opts.on('--days N', Integer, 'Artworks not updated in N days (default: 30)') do |n|
      options[:days] = n
    end

    opts.on('--execute', 'Execute the cleanup (default is dry-run)') do
      options[:execute] = true
    end

    opts.on('--remote', 'Use remote D1 database') do
      options[:remote] = true
    end

    opts.on('--delete-r2', 'Allow R2 file deletion (required for R2 cleanup)') do
      options[:delete_r2] = true
    end

    opts.on('-v', '--verbose', 'Verbose output') do
      options[:verbose] = true
    end

    opts.on('-h', '--help', 'Show this message') do
      puts opts
      exit
    end
  end.parse!

  begin
    cleanup = OrphanCleanup.new(options)
    cleanup.run
  rescue => e
    puts "Error: #{e.message}".red
    exit 1
  end
end

main if __FILE__ == $0
