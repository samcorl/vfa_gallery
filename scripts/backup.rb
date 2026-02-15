#!/usr/bin/env ruby

require 'fileutils'
require 'json'
require 'time'
require 'optparse'
require 'colorize'
require_relative 'lib/db_helper'

class DatabaseBackup
  BACKUP_DIR = File.join(DbHelper.project_root, 'scripts', 'backups')
  MANIFEST_FILE = File.join(BACKUP_DIR, 'MANIFEST.json')
  MAX_BACKUPS_IN_MANIFEST = 30
  R2_BUCKET_NAME = ENV['R2_BUCKET_NAME'] || 'vfa-gallery-images'

  def initialize(options = {})
    @remote = options[:remote] || false
    @upload_to_r2 = options[:r2_upload] || false
    @verbose = options[:verbose] || false

    FileUtils.mkdir_p(BACKUP_DIR) unless Dir.exist?(BACKUP_DIR)
  end

  def run
    start_time = Time.now

    if @remote
      backup_remote
    else
      backup_local
    end

    elapsed = Time.now - start_time
    puts "\n✓ Backup completed in #{format_time(elapsed)}".green
  rescue StandardError => e
    puts "\n✗ Backup failed: #{e.message}".red
    exit 1
  end

  private

  def backup_local
    puts "Starting local database backup...".cyan

    db_path = DbHelper.discover_db_path
    backup_file = generate_backup_filename('local')

    puts "Database path: #{db_path}".yellow if @verbose
    puts "Backup destination: #{backup_file}".yellow if @verbose

    # Use sqlite3 CLI to dump the database
    cmd = %(%{sqlite3 '#{db_path}' '.dump'} > "#{backup_file}")

    unless system(cmd)
      File.delete(backup_file) if File.exist?(backup_file)
      raise "Failed to backup local database"
    end

    file_size = File.size(backup_file)
    puts "✓ Local backup created: #{File.basename(backup_file)} (#{format_size(file_size)})".green

    update_manifest(backup_file, 'local', file_size)

    if @upload_to_r2
      upload_to_r2(backup_file)
    end
  end

  def backup_remote
    puts "Starting remote database backup via wrangler...".cyan

    backup_file = generate_backup_filename('remote')

    puts "Backup destination: #{backup_file}".yellow if @verbose

    cmd = "npx wrangler d1 export vfa-gallery-db --remote --output #{backup_file}"

    unless system(cmd)
      File.delete(backup_file) if File.exist?(backup_file)
      raise "Failed to backup remote database"
    end

    file_size = File.size(backup_file)
    puts "✓ Remote backup created: #{File.basename(backup_file)} (#{format_size(file_size)})".green

    update_manifest(backup_file, 'remote', file_size)

    if @upload_to_r2
      upload_to_r2(backup_file)
    end
  end

  def upload_to_r2(backup_file)
    puts "\nUploading to R2...".cyan

    validate_r2_credentials

    require 'aws-sdk-s3'

    s3_client = Aws::S3::Client.new(
      region: 'auto',
      access_key_id: ENV['R2_ACCESS_KEY_ID'],
      secret_access_key: ENV['R2_SECRET_ACCESS_KEY'],
      endpoint: "https://#{ENV['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    )

    file_key = "backups/#{File.basename(backup_file)}"

    File.open(backup_file, 'rb') do |file|
      s3_client.put_object(
        bucket: R2_BUCKET_NAME,
        key: file_key,
        body: file
      )
    end

    puts "✓ Backup uploaded to R2: #{file_key}".green
  rescue Aws::Errors::ServiceError => e
    puts "✗ R2 upload failed: #{e.message}".red
    raise
  rescue LoadError
    puts "✗ aws-sdk-s3 gem not found. Install it with: gem install aws-sdk-s3".red
    raise
  end

  def validate_r2_credentials
    required_vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    missing = required_vars.reject { |var| ENV[var] }

    unless missing.empty?
      raise "Missing R2 credentials: #{missing.join(', ')}"
    end
  end

  def generate_backup_filename(type)
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    File.join(BACKUP_DIR, "vfa-gallery-#{type}_#{timestamp}.sql")
  end

  def update_manifest(backup_file, backup_type, file_size)
    manifest = load_manifest

    entry = {
      'filename' => File.basename(backup_file),
      'type' => backup_type,
      'size_bytes' => file_size,
      'timestamp' => Time.now.iso8601
    }

    manifest['backups'] ||= []
    manifest['backups'].unshift(entry)
    manifest['backups'] = manifest['backups'].take(MAX_BACKUPS_IN_MANIFEST)
    manifest['last_backup'] = Time.now.iso8601

    File.write(MANIFEST_FILE, JSON.pretty_generate(manifest))

    puts "✓ Manifest updated".green if @verbose
  end

  def load_manifest
    return { 'backups' => [] } unless File.exist?(MANIFEST_FILE)
    JSON.parse(File.read(MANIFEST_FILE))
  rescue JSON::ParserError
    { 'backups' => [] }
  end

  def format_size(bytes)
    case bytes
    when 0..1024
      "#{bytes} B"
    when 1024..1048576
      "#{(bytes / 1024.0).round(2)} KB"
    when 1048576..1073741824
      "#{(bytes / 1048576.0).round(2)} MB"
    else
      "#{(bytes / 1073741824.0).round(2)} GB"
    end
  end

  def format_time(seconds)
    if seconds < 60
      "#{seconds.round(2)}s"
    else
      minutes = seconds / 60
      secs = seconds % 60
      "#{minutes.round}m #{secs.round(1)}s"
    end
  end
end

# Parse command line options
options = {}
parser = OptionParser.new do |opts|
  opts.banner = "Usage: backup.rb [options]"
  opts.on('--remote', 'Backup from remote production database') { options[:remote] = true }
  opts.on('--r2-upload', 'Upload backup to R2 bucket') { options[:r2_upload] = true }
  opts.on('-v', '--verbose', 'Verbose output') { options[:verbose] = true }
  opts.on('-h', '--help', 'Show this help message') do
    puts opts
    exit
  end
end

begin
  parser.parse!
rescue OptionParser::InvalidOption => e
  puts e.message
  puts parser
  exit 1
end

backup = DatabaseBackup.new(options)
backup.run
