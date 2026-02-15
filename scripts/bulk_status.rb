#!/usr/bin/env ruby

require 'csv'
require 'optparse'
require 'colorize'
require 'securerandom'
require 'json'
require 'io/console'
require_relative 'lib/db_helper'

class BulkStatusUpdater
  def initialize(csv_path, remote: false, dry_run: true)
    @csv_path = csv_path
    @remote = remote
    @dry_run = dry_run
    @db = remote ? nil : DbHelper.local_connection
    @updates = []
  end

  def load_csv
    unless File.exist?(@csv_path)
      raise "CSV file not found: #{@csv_path}"
    end

    CSV.foreach(@csv_path, headers: true) do |row|
      user_id = row['user_id'].to_s.strip
      new_status = row['new_status'].to_s.strip
      reason = row['reason'].to_s.strip

      if user_id.empty?
        raise "Invalid CSV: user_id cannot be empty"
      end

      unless %w[active suspended pending].include?(new_status)
        raise "Invalid status '#{new_status}' for user #{user_id}. Must be: active, suspended, or pending"
      end

      @updates << {
        user_id: user_id,
        new_status: new_status,
        reason: reason
      }
    end

    if @updates.empty?
      raise "No valid updates found in CSV"
    end

    puts "Loaded #{@updates.length} status updates from CSV".green
  end

  def validate_users
    puts "\nValidating users exist...".cyan
    invalid_count = 0

    @updates.each do |update|
      sql = "SELECT id, status FROM users WHERE id = ?"
      results = execute_query(sql, [update[:user_id]])

      if results.empty?
        puts "Warning: User not found: #{update[:user_id]}".yellow
        invalid_count += 1
      else
        update[:old_status] = results.first['status']
        update[:valid] = true
      end
    end

    if invalid_count > 0
      puts "#{invalid_count} users not found. Remove from CSV and try again.".red
      exit 1
    end

    puts "All users validated.".green
  end

  def preview
    puts "\n" + "=== PREVIEW (Dry Run) ===".cyan
    puts "The following changes would be applied:\n"

    rows = @updates.map do |update|
      [
        update[:user_id][0..15],
        update[:old_status],
        update[:new_status],
        update[:reason]
      ]
    end

    table = TTY::Table.new(
      header: ['User ID', 'Current Status', 'New Status', 'Reason'],
      rows: rows
    )

    puts table.render(:ascii)
    puts "\nTotal updates: #{@updates.length}"
  end

  def confirm_execution
    puts "\n" + "WARNING: This will update #{@updates.length} user statuses.".red
    puts "This action cannot be easily undone.\n"
    print "Type 'yes' to confirm: ".yellow
    confirmation = $stdin.gets.chomp

    unless confirmation.downcase == 'yes'
      puts "Cancelled.".yellow
      exit 0
    end
  end

  def execute
    puts "\n" + "=== EXECUTING UPDATES ===".cyan
    failed = 0
    succeeded = 0

    @updates.each do |update|
      begin
        user_id = update[:user_id]
        new_status = update[:new_status]
        old_status = update[:old_status]
        reason = update[:reason]

        # Update user status
        sql_update = "UPDATE users SET status = ?, updated_at = ? WHERE id = ?"
        execute_update(sql_update, [new_status, current_timestamp, user_id])

        # Create activity log entry
        activity_id = SecureRandom.uuid
        metadata = {
          old_status: old_status,
          new_status: new_status,
          reason: reason
        }.to_json

        sql_log = "INSERT INTO activity_log (id, user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'status_changed', 'user', ?, ?, ?)"
        execute_update(sql_log, [activity_id, user_id, user_id, metadata, current_timestamp])

        puts "✓ #{user_id[0..15]}: #{old_status} → #{new_status}".green
        succeeded += 1
      rescue => e
        puts "✗ #{user_id[0..15]}: #{e.message}".red
        failed += 1
      end
    end

    puts "\n" + "=== SUMMARY ===".cyan
    puts "Succeeded: #{succeeded}".green
    puts "Failed:    #{failed}".red if failed > 0
    puts "Total:     #{@updates.length}"
  end

  private

  def execute_query(sql, params = [])
    if @remote
      D1RemoteHelper.execute_query(sql)
    else
      @db.execute(sql, params)
    end
  end

  def execute_update(sql, params = [])
    if @remote
      # For remote, we'd need to handle this differently
      # This is a simplified version
      D1RemoteHelper.execute_query(sql)
    else
      @db.execute(sql, params)
    end
  end

  def current_timestamp
    Time.now.iso8601
  end
end

def main
  options = {
    csv_path: nil,
    remote: false,
    execute: false
  }

  OptionParser.new do |opts|
    opts.banner = "Usage: bulk_status.rb [OPTIONS] <csv_file>"

    opts.on('--execute', 'Execute the updates (default is dry-run)') { options[:execute] = true }
    opts.on('--remote', 'Use remote D1 database') { options[:remote] = true }
    opts.on('-h', '--help', 'Show this message') do
      puts opts
      exit
    end
  end.parse!

  # Get CSV path from arguments
  options[:csv_path] = ARGV[0]

  if options[:csv_path].nil?
    puts "Error: CSV file path is required".red
    puts "Usage: bulk_status.rb [--execute] [--remote] <csv_file>"
    exit 1
  end

  begin
    updater = BulkStatusUpdater.new(options[:csv_path], remote: options[:remote], dry_run: !options[:execute])

    updater.load_csv
    updater.validate_users
    updater.preview

    if options[:execute]
      updater.confirm_execution
      updater.execute
    else
      puts "\n" + "This is a DRY RUN. Use --execute to apply changes.".yellow
    end
  rescue => e
    puts "Error: #{e.message}".red
    exit 1
  end
end

main if __FILE__ == $0
