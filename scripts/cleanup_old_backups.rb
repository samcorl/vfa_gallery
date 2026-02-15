#!/usr/bin/env ruby

require 'fileutils'
require 'time'
require 'optparse'
require 'colorize'
require_relative 'lib/db_helper'

class BackupCleanup
  BACKUP_DIR = File.join(DbHelper.project_root, 'scripts', 'backups')
  BACKUP_RETENTION_DAYS = 30
  MAX_LOCAL_BACKUPS = 50

  def initialize(options = {})
    @retention_days = options[:retention_days] || BACKUP_RETENTION_DAYS
    @max_backups = options[:max_backups] || MAX_LOCAL_BACKUPS
    @dry_run = options[:dry_run] || false
    @verbose = options[:verbose] || false
  end

  def run
    puts "Scanning backup directory: #{BACKUP_DIR}".cyan

    unless Dir.exist?(BACKUP_DIR)
      puts "✓ Backup directory does not exist".green
      return
    end

    backup_files = find_backup_files
    puts "Found #{backup_files.length} backup files".yellow

    deleted_count = 0
    deleted_size = 0

    # Delete old files by retention days
    backup_files.each do |file|
      if should_delete_by_age?(file)
        deleted_count += 1
        deleted_size += File.size(file)
        delete_file(file)
      end
    end

    # If still over max backups, delete oldest
    if backup_files.length > @max_backups
      excess_count = backup_files.length - @max_backups
      backup_files.sort_by { |f| File.mtime(f) }[0...excess_count].each do |file|
        unless File.exist?(file)
          puts "  Already deleted: #{File.basename(file)}".gray if @verbose
          next
        end

        deleted_count += 1
        deleted_size += File.size(file)
        delete_file(file)
      end
    end

    # Summary
    puts "\n" + "=".cyan * 50
    if @dry_run
      puts "DRY RUN: Would have deleted #{deleted_count} files (#{format_size(deleted_size)})".yellow
    else
      puts "✓ Deleted #{deleted_count} old backup files (#{format_size(deleted_size)})".green
    end
    puts "Remaining backups: #{(backup_files.length - deleted_count).max(0)}".cyan
  end

  private

  def find_backup_files
    Dir.glob(File.join(BACKUP_DIR, '*.sql')).select { |f| File.file?(f) }
  end

  def should_delete_by_age?(file)
    file_age_days = (Time.now - File.mtime(file)) / 86400
    file_age_days > @retention_days
  end

  def delete_file(file)
    filename = File.basename(file)
    file_size = File.size(file)

    if @dry_run
      puts "  [DRY RUN] Would delete: #{filename} (#{format_size(file_size)})".yellow
    else
      File.delete(file)
      puts "  ✓ Deleted: #{filename} (#{format_size(file_size)})".green
    end
  rescue StandardError => e
    puts "  ✗ Error deleting #{filename}: #{e.message}".red
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
end

# Parse command line options
options = {}
parser = OptionParser.new do |opts|
  opts.banner = "Usage: cleanup_old_backups.rb [options]"
  opts.on('--retention-days DAYS', Integer, "Delete backups older than N days (default: #{BackupCleanup::BACKUP_RETENTION_DAYS})") do |days|
    options[:retention_days] = days
  end
  opts.on('--max-backups NUM', Integer, "Keep maximum N backups (default: #{BackupCleanup::MAX_LOCAL_BACKUPS})") do |num|
    options[:max_backups] = num
  end
  opts.on('--dry-run', 'Show what would be deleted without actually deleting') { options[:dry_run] = true }
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

cleanup = BackupCleanup.new(options)
cleanup.run
