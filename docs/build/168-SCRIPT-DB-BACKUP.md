# 168-SCRIPT-DB-BACKUP.md
## Database Backup Script

**Goal:** Create a Ruby script to export the D1 database to a timestamped SQL file with optional upload to CloudFlare R2 for offsite storage.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Database:** CloudFlare D1 (SQLite-compatible)
- **Image Storage:** CloudFlare R2 (S3-compatible)
- **Backup Strategy:** Regular exports for disaster recovery

---

## Prerequisites

**Must Complete First:**
- 04-D1-DATABASE-INIT.md ✓
- 05-R2-BUCKET-INIT.md ✓
- 06-SCHEMA-USERS.md ✓ (and all schema files)
- 166-SCRIPT-USER-MANAGEMENT.md ✓ (for context)

**Local Requirements:**
- Ruby 3.0+ installed
- Gems: `sqlite3`, `optparse`, `colorize`, `aws-sdk-s3`, `fileutils`
- Wrangler configured with D1 and R2 access
- AWS credentials for R2 (optional, for remote upload)

---

## Steps

### Step 1: Add Required Gems

Update `/site/Gemfile`:

```ruby
source 'https://rubygems.org'

gem 'sqlite3', '~> 1.6'
gem 'tty-table', '~> 0.12'
gem 'colorize', '~> 0.8'
gem 'optparse', '~> 0.1'
gem 'aws-sdk-s3', '~> 1.120'
gem 'dotenv', '~> 2.8'
```

Run:

```bash
cd /site
bundle install
```

### Step 2: Create Backup Script

Create `/site/scripts/backup.rb`:

```ruby
#!/usr/bin/env ruby

require 'sqlite3'
require 'optparse'
require 'colorize'
require 'fileutils'
require 'time'
require 'dotenv/load'

# Configuration
class Config
  attr_reader :db_path, :backup_dir, :r2_upload, :r2_bucket, :r2_key_prefix, :remote

  def initialize
    @db_path = ENV['D1_DB_PATH'] || File.expand_path('../.wrangler/state/d1/db/site-db.sqlite3', __dir__)
    @backup_dir = File.expand_path('../backups', __dir__)
    @r2_upload = false
    @r2_bucket = ENV['R2_BUCKET_NAME'] || 'site-backups'
    @r2_key_prefix = 'db-backups/'
    @remote = false

    parse_options
  end

  def parse_options
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: ruby scripts/backup.rb [OPTIONS]"

      opts.on('-o', '--output DIR', 'Backup output directory (default: scripts/backups)') do |dir|
        @backup_dir = dir
      end

      opts.on('-r', '--r2-upload', 'Upload backup to R2 after creation') do
        @r2_upload = true
      end

      opts.on('--r2-bucket BUCKET', 'R2 bucket name (default: site-backups)') do |bucket|
        @r2_bucket = bucket
      end

      opts.on('--remote', 'Backup remote D1 database (production)') do
        @remote = true
      end

      opts.on('-h', '--help', 'Show this help message') do
        puts opts
        puts "\nExamples:"
        puts "  # Local backup"
        puts "  ruby scripts/backup.rb"
        puts ""
        puts "  # Local backup and upload to R2"
        puts "  ruby scripts/backup.rb --r2-upload"
        puts ""
        puts "  # Backup production database"
        puts "  ruby scripts/backup.rb --remote"
        exit(0)
      end
    end

    parser.parse!
  end
end

# Database backup handler
class DatabaseBackup
  def initialize(db_path)
    @db_path = db_path
    @db = nil
  end

  def backup_local(output_file)
    unless File.exist?(@db_path)
      raise "Database file not found: #{@db_path}"
    end

    # Use sqlite3 CLI to dump database
    # This is more reliable than programmatic export
    cmd = "sqlite3 '#{@db_path}' '.dump'"

    output = `#{cmd}`

    unless $?.success?
      raise "sqlite3 dump failed"
    end

    File.write(output_file, output)
    File.size(output_file)
  rescue StandardError => e
    raise "Failed to backup database: #{e.message}"
  end

  def backup_remote(output_file, database_name = 'site-db')
    # Use wrangler to dump remote database
    cmd = "npx wrangler d1 execute #{database_name} '.dump' --remote"

    output = `#{cmd}`

    unless $?.success?
      raise "wrangler d1 dump failed"
    end

    File.write(output_file, output)
    File.size(output_file)
  rescue StandardError => e
    raise "Failed to backup remote database: #{e.message}"
  end
end

# R2 upload handler
class R2Uploader
  def initialize(bucket_name, key_prefix = 'db-backups/')
    @bucket_name = bucket_name
    @key_prefix = key_prefix
    @s3_client = nil

    configure_s3
  end

  def upload(local_file, remote_key = nil)
    raise 'S3 client not configured' unless @s3_client

    remote_key ||= File.basename(local_file)
    full_key = "#{@key_prefix}#{remote_key}"

    File.open(local_file, 'rb') do |file|
      @s3_client.put_object(
        bucket: @bucket_name,
        key: full_key,
        body: file,
        metadata: {
          'uploaded_at' => Time.now.iso8601,
          'source' => 'backup-script'
        }
      )
    end

    full_key
  rescue StandardError => e
    raise "Failed to upload to R2: #{e.message}"
  end

  private

  def configure_s3
    require 'aws-sdk-s3'

    # R2 uses S3-compatible API
    @s3_client = Aws::S3::Client.new(
      region: 'auto',
      endpoint: ENV['R2_ENDPOINT'] || "https://#{ENV['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
      access_key_id: ENV['R2_ACCESS_KEY_ID'],
      secret_access_key: ENV['R2_SECRET_ACCESS_KEY']
    )
  rescue StandardError => e
    raise "Failed to configure R2 client: #{e.message}"
  end
end

# Display handlers
class DisplayFormatter
  def self.print_header
    puts "\n" + "Database Backup".cyan.bold
    puts "─" * 60
    puts
  end

  def self.print_status(message)
    puts "#{message}...".cyan
  end

  def self.print_details(db_path, output_file, file_size, elapsed_time)
    puts "\nBackup Details".cyan.bold
    puts "─" * 60
    puts "Database:    #{db_path}"
    puts "Output:      #{output_file}"
    puts "File size:   #{format_bytes(file_size)}"
    puts "Time:        #{elapsed_time.round(2)}s"
    puts
  end

  def self.print_r2_upload(r2_key)
    puts "\nR2 Upload".cyan.bold
    puts "─" * 60
    puts "Location:    s3://#{ENV['R2_BUCKET_NAME']}/#{r2_key}".green
    puts
  end

  def self.print_success
    puts "✓ Backup completed successfully".green
  end

  def self.print_warning(message)
    puts "⚠ #{message}".yellow
  end

  def self.error(message)
    puts "✗ Error: #{message}".red
  end

  def self.format_bytes(bytes)
    units = ['B', 'KB', 'MB', 'GB']
    size = bytes.to_f
    unit_index = 0

    while size > 1024 && unit_index < units.length - 1
      size /= 1024
      unit_index += 1
    end

    "#{size.round(2)} #{units[unit_index]}"
  end
end

# Backup manifest for tracking
class BackupManifest
  def initialize(backup_dir)
    @backup_dir = backup_dir
    @manifest_file = File.join(backup_dir, 'MANIFEST.json')
  end

  def add_backup(filename, file_size, remote_key = nil)
    require 'json'

    backups = load_manifest

    backups << {
      filename: filename,
      size_bytes: file_size,
      created_at: Time.now.iso8601,
      r2_key: remote_key
    }

    # Keep only last 30 backups
    backups = backups.last(30)

    File.write(@manifest_file, JSON.pretty_generate(backups))
  end

  def load_manifest
    require 'json'

    return [] unless File.exist?(@manifest_file)

    JSON.parse(File.read(@manifest_file))
  rescue StandardError
    []
  end

  def list_backups
    load_manifest
  end
end

# Main application
class BackupApp
  def initialize(config)
    @config = config
    @backup = DatabaseBackup.new(config.db_path)
  end

  def run
    DisplayFormatter.print_header

    # Create backup directory
    FileUtils.mkdir_p(@config.backup_dir)

    # Generate timestamped filename
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    filename = if @config.remote
                 "site-remote_#{timestamp}.sql"
               else
                 "site-local_#{timestamp}.sql"
               end
    backup_file = File.join(@config.backup_dir, filename)

    # Perform backup
    DisplayFormatter.print_status('Creating database backup')
    start_time = Time.now

    begin
      file_size = if @config.remote
                    @backup.backup_remote(backup_file)
                  else
                    @backup.backup_local(backup_file)
                  end

      elapsed = Time.now - start_time

      DisplayFormatter.print_details(@config.db_path, backup_file, file_size, elapsed)

      # Update manifest
      manifest = BackupManifest.new(@config.backup_dir)

      # Upload to R2 if requested
      remote_key = nil
      if @config.r2_upload
        DisplayFormatter.print_status('Uploading to R2')

        uploader = R2Uploader.new(@config.r2_bucket)
        remote_key = uploader.upload(backup_file, filename)

        DisplayFormatter.print_r2_upload(remote_key)
      end

      manifest.add_backup(filename, file_size, remote_key)

      DisplayFormatter.print_success
    rescue StandardError => e
      DisplayFormatter.error(e.message)
      exit(1)
    end
  end
end

# Entry point
if __FILE__ == $0
  begin
    config = Config.new
    app = BackupApp.new(config)
    app.run
  rescue Interrupt
    puts "\n\nInterrupted.".yellow
    exit(0)
  rescue StandardError => e
    DisplayFormatter.error "Fatal error: #{e.message}"
    puts e.backtrace if ENV['DEBUG']
    exit(1)
  end
end
```

### Step 3: Make Script Executable

```bash
chmod +x /site/scripts/backup.rb
```

### Step 4: Create Environment File

Create `/site/.env.backup` (for local development):

```bash
# D1 Database path (auto-detected if not set)
# D1_DB_PATH=/path/to/db.sqlite3

# R2 Configuration (required for --r2-upload)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_BUCKET_NAME=site-backups
```

Add to `.gitignore`:

```bash
echo ".env.backup" >> /site/.gitignore
```

### Step 5: Create Backup Directory

```bash
mkdir -p /site/scripts/backups
```

### Step 6: Create Cleanup Script

Create `/site/scripts/cleanup_old_backups.rb`:

```ruby
#!/usr/bin/env ruby

require 'fileutils'
require 'colorize'
require 'optparse'
require 'time'

# Keep only N most recent backups
RETENTION_DAYS = ENV['BACKUP_RETENTION_DAYS']&.to_i || 30
MAX_LOCAL_BACKUPS = ENV['MAX_LOCAL_BACKUPS']&.to_i || 50

backup_dir = File.expand_path('../backups', __dir__)

unless Dir.exist?(backup_dir)
  puts "Backup directory not found: #{backup_dir}".red
  exit(1)
end

# Find all .sql files
backup_files = Dir.glob(File.join(backup_dir, '*.sql'))
  .sort_by { |f| File.mtime(f) }
  .reverse

puts "Found #{backup_files.length} backup files".cyan

# Delete old files by age
deleted_by_age = 0
cutoff_time = Time.now - (RETENTION_DAYS * 86400)

backup_files.each do |file|
  if File.mtime(file) < cutoff_time
    FileUtils.rm(file)
    puts "Deleted (age): #{File.basename(file)}".yellow
    deleted_by_age += 1
  end
end

# Delete excess files if over max
if backup_files.length - deleted_by_age > MAX_LOCAL_BACKUPS
  excess = (backup_files.length - deleted_by_age) - MAX_LOCAL_BACKUPS
  backup_files.drop(deleted_by_age).last(excess).each do |file|
    FileUtils.rm(file)
    puts "Deleted (excess): #{File.basename(file)}".yellow
  end
end

puts "Cleanup complete. Retained: #{(backup_files.length - deleted_by_age).clamp(0, MAX_LOCAL_BACKUPS)}".green
```

### Step 7: Add Documentation

Update `/site/docs/ADMIN-SCRIPTS.md`:

```markdown
## Database Backup Script

Create timestamped backups of the D1 database with optional R2 upload.

### Installation

Already completed with other scripts.

### Usage

#### Create local backup
```bash
ruby scripts/backup.rb
```

#### Create backup and upload to R2
```bash
ruby scripts/backup.rb --r2-upload
```

#### Backup production database
```bash
ruby scripts/backup.rb --remote
```

#### Backup production and upload to R2
```bash
ruby scripts/backup.rb --remote --r2-upload
```

#### Specify custom backup directory
```bash
ruby scripts/backup.rb --output /custom/path
```

### Environment Variables (for R2 upload)

Create `.env.backup`:
```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_BUCKET_NAME=site-backups
```

### Backup Location

Local backups are stored in `/scripts/backups/` with naming convention:
- Local: `site-local_YYYYMMDD_HHMMSS.sql`
- Remote: `site-remote_YYYYMMDD_HHMMSS.sql`

A `MANIFEST.json` file tracks all backups with metadata.

### Restore from Backup

```bash
# Restore local backup
sqlite3 /path/to/db.sqlite3 < scripts/backups/site-local_20240115_120000.sql

# Restore to remote D1
npx wrangler d1 execute site-db --file scripts/backups/site-remote_20240115_120000.sql --remote
```

### Cleanup Old Backups

```bash
# Keep only last 30 days and max 50 local backups
ruby scripts/cleanup_old_backups.rb
```

Customize with environment variables:
```bash
BACKUP_RETENTION_DAYS=60 MAX_LOCAL_BACKUPS=100 ruby scripts/cleanup_old_backups.rb
```

### Recommended Schedule

Add to cron for automatic backups:

```bash
# Daily at 2 AM, keep 7 days
0 2 * * * cd /site && ruby scripts/backup.rb --r2-upload > /tmp/backup.log 2>&1

# Weekly cleanup (Sundays at 3 AM)
0 3 * * 0 cd /site && ruby scripts/cleanup_old_backups.rb BACKUP_RETENTION_DAYS=7
```
```

---

## Files to Create/Modify

**Created:**
- `/site/scripts/backup.rb` - Database backup script (executable)
- `/site/scripts/cleanup_old_backups.rb` - Backup cleanup script (executable)
- `/site/.env.backup` - Environment configuration template
- `/site/scripts/backups/` - Backup storage directory
- `/site/docs/ADMIN-SCRIPTS.md` - Updated with backup docs

**Modified:**
- `/site/Gemfile` - Added aws-sdk-s3, dotenv
- `/site/.gitignore` - Added .env.backup, scripts/backups/*

---

## Verification Checklist

- [ ] `bundle install` completes with new gems
- [ ] `ruby scripts/backup.rb --help` shows usage
- [ ] Local backup creates timestamped SQL file in scripts/backups/
- [ ] Backup file contains valid SQL dump with CREATE TABLE statements
- [ ] MANIFEST.json created with backup metadata
- [ ] Backup file size is reasonable (typically 1-100MB depending on data)
- [ ] `--remote` flag successfully dumps production database
- [ ] R2 upload succeeds when configured with valid credentials
- [ ] Uploaded file appears in R2 bucket with correct timestamp
- [ ] Cleanup script removes old backups by retention date
- [ ] Cleanup script respects max backup count
- [ ] Restored backup can be reloaded into database
- [ ] Color output displays correctly
- [ ] Script handles missing database file gracefully
- [ ] Script handles R2 auth errors clearly

Once verified, proceed to **169-SCRIPT-ANALYTICS-EXPORT.md**.
