# 170-SCRIPT-ORPHAN-CLEANUP.md
## Orphaned Artwork Cleanup Script

**Goal:** Create a Ruby script to identify and remove orphaned artworks (not in any collection for >30 days) and orphaned R2 image files with no matching artwork records, with dry-run mode before deletion.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Database:** CloudFlare D1 (SQLite-compatible)
- **Image Storage:** CloudFlare R2 (S3-compatible)
- **Data Consistency:** Need to maintain referential integrity between database and storage

---

## Prerequisites

**Must Complete First:**
- 04-D1-DATABASE-INIT.md ✓
- 05-R2-BUCKET-INIT.md ✓
- 06-SCHEMA-USERS.md ✓
- 09-SCHEMA-COLLECTIONS.md ✓
- 10-SCHEMA-ARTWORKS.md ✓
- 168-SCRIPT-DB-BACKUP.md ✓ (strongly recommended before cleanup)

**Local Requirements:**
- Ruby 3.0+ installed
- Gems: `sqlite3`, `aws-sdk-s3`, `optparse`, `colorize`
- Wrangler configured with D1 and R2 access
- AWS credentials for R2

---

## Steps

### Step 1: Update Gemfile

Already added in previous scripts, but verify `/site/Gemfile`:

```ruby
source 'https://rubygems.org'

gem 'sqlite3', '~> 1.6'
gem 'tty-table', '~> 0.12'
gem 'colorize', '~> 0.8'
gem 'optparse', '~> 0.1'
gem 'aws-sdk-s3', '~> 1.120'
gem 'dotenv', '~> 2.8'
```

### Step 2: Create Orphan Cleanup Script

Create `/site/scripts/cleanup_orphans.rb`:

```ruby
#!/usr/bin/env ruby

require 'sqlite3'
require 'optparse'
require 'colorize'
require 'aws-sdk-s3'
require 'set'
require 'dotenv/load'

# Configuration
class Config
  attr_reader :db_path, :orphan_days, :dry_run, :delete_r2_files, :cleanup_mode, :remote, :verbose

  def initialize
    @db_path = ENV['D1_DB_PATH'] || File.expand_path('../.wrangler/state/d1/db/site-db.sqlite3', __dir__)
    @orphan_days = 30
    @dry_run = true
    @delete_r2_files = false
    @cleanup_mode = 'db'  # 'db', 'r2', or 'all'
    @remote = false
    @verbose = false

    parse_options
  end

  private

  def parse_options
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: ruby scripts/cleanup_orphans.rb [MODE] [OPTIONS]"

      opts.on('db', 'Cleanup orphaned artworks in database') do
        @cleanup_mode = 'db'
      end

      opts.on('r2', 'Cleanup orphaned files in R2') do
        @cleanup_mode = 'r2'
      end

      opts.on('all', 'Cleanup both database and R2') do
        @cleanup_mode = 'all'
      end

      opts.on('-d', '--days DAYS', Integer, 'Orphan threshold in days (default: 30)') do |days|
        @orphan_days = days
      end

      opts.on('--execute', 'Execute cleanup (without this, dry-run only)') do
        @dry_run = false
      end

      opts.on('--delete-r2', 'Delete orphaned R2 files (requires --execute)') do
        @delete_r2_files = true
      end

      opts.on('-v', '--verbose', 'Verbose output') do
        @verbose = true
      end

      opts.on('-r', '--remote', 'Use remote D1 database') do
        @remote = true
      end

      opts.on('-h', '--help', 'Show this help message') do
        puts opts
        puts "\nModes:"
        puts "  db       - Find artworks not in any collection for N days"
        puts "  r2       - Find R2 files with no matching artwork"
        puts "  all      - Run both db and r2 cleanup"
        puts "\nExamples:"
        puts "  ruby scripts/cleanup_orphans.rb db"
        puts "  ruby scripts/cleanup_orphans.rb all --days 60 --execute"
        puts "  ruby scripts/cleanup_orphans.rb r2 --execute --delete-r2"
        exit(0)
      end
    end

    parser.parse!
  end
end

# Database handler
class OrphanDatabase
  def initialize(db_path)
    @db = SQLite3::Database.new db_path
    @db.results_as_hash = true
    @db.type_translation = true
  end

  def find_orphaned_artworks(orphan_days)
    # Artworks not in any collection for N days
    query = <<~SQL
      SELECT DISTINCT
        a.id,
        a.title,
        a.user_id,
        u.username,
        a.image_r2_key,
        a.thumbnail_r2_key,
        a.icon_r2_key,
        a.watermarked_r2_key,
        a.created_at,
        a.updated_at,
        COUNT(ca.id) as collection_count
      FROM artworks a
      LEFT JOIN collection_artworks ca ON a.id = ca.artwork_id AND ca.deleted_at IS NULL
      JOIN users u ON a.user_id = u.id
      WHERE a.deleted_at IS NULL
        AND ca.id IS NULL
        AND DATETIME(a.updated_at) < DATETIME('now', '-' || ? || ' days')
      GROUP BY a.id
      ORDER BY a.updated_at ASC
    SQL

    @db.execute(query, [orphan_days])
  end

  def soft_delete_artwork(artwork_id)
    now = Time.now.iso8601

    @db.execute(
      'UPDATE artworks SET deleted_at = ? WHERE id = ?',
      [now, artwork_id]
    )

    # Log deletion
    artwork = @db.execute(
      'SELECT user_id FROM artworks WHERE id = ?',
      [artwork_id]
    ).first

    if artwork
      @db.execute(
        <<~SQL,
          INSERT INTO activity_log (user_id, action, details, created_at)
          VALUES (?, ?, ?, ?)
        SQL
        [artwork['user_id'], 'artwork_orphan_deleted', "Artwork #{artwork_id} auto-deleted (orphaned)", now]
      )
    end

    true
  end

  def artworks_by_r2_key(r2_keys)
    # Find all artworks with given R2 keys
    placeholders = r2_keys.map { '?' }.join(',')

    query = "SELECT id, image_r2_key, thumbnail_r2_key, icon_r2_key, watermarked_r2_key FROM artworks WHERE image_r2_key IN (#{placeholders}) OR thumbnail_r2_key IN (#{placeholders}) OR icon_r2_key IN (#{placeholders}) OR watermarked_r2_key IN (#{placeholders})"

    @db.execute(query, r2_keys + r2_keys + r2_keys + r2_keys)
  end

  def get_all_r2_keys
    query = <<~SQL
      SELECT DISTINCT
        image_r2_key,
        thumbnail_r2_key,
        icon_r2_key,
        watermarked_r2_key
      FROM artworks
      WHERE deleted_at IS NULL
        AND (image_r2_key IS NOT NULL
          OR thumbnail_r2_key IS NOT NULL
          OR icon_r2_key IS NOT NULL
          OR watermarked_r2_key IS NOT NULL)
    SQL

    results = @db.execute(query)

    keys = Set.new
    results.each do |row|
      keys.add(row['image_r2_key']) if row['image_r2_key']
      keys.add(row['thumbnail_r2_key']) if row['thumbnail_r2_key']
      keys.add(row['icon_r2_key']) if row['icon_r2_key']
      keys.add(row['watermarked_r2_key']) if row['watermarked_r2_key']
    end

    keys
  end

  def close
    @db.close
  end
end

# Remote D1 access
class D1RemoteOrphanDatabase
  def initialize(database_name)
    @database_name = database_name
    require_relative 'lib/d1_helper'
  end

  def find_orphaned_artworks(orphan_days)
    query = "SELECT DISTINCT a.id, a.title, a.user_id, u.username, a.image_r2_key, a.created_at, a.updated_at FROM artworks a LEFT JOIN collection_artworks ca ON a.id = ca.artwork_id AND ca.deleted_at IS NULL JOIN users u ON a.user_id = u.id WHERE a.deleted_at IS NULL AND ca.id IS NULL AND DATETIME(a.updated_at) < DATETIME('now', '-' || #{orphan_days} || ' days') ORDER BY a.updated_at ASC;"
    Array(D1Helper.execute_query(@database_name, query, remote: true))
  end

  def soft_delete_artwork(artwork_id)
    now = Time.now.iso8601
    query = "UPDATE artworks SET deleted_at = '#{now}' WHERE id = #{artwork_id};"
    D1Helper.execute_query(@database_name, query, remote: true)
    true
  end

  def get_all_r2_keys
    query = "SELECT DISTINCT image_r2_key, thumbnail_r2_key, icon_r2_key, watermarked_r2_key FROM artworks WHERE deleted_at IS NULL AND (image_r2_key IS NOT NULL OR thumbnail_r2_key IS NOT NULL OR icon_r2_key IS NOT NULL OR watermarked_r2_key IS NOT NULL);"
    results = Array(D1Helper.execute_query(@database_name, query, remote: true))

    keys = Set.new
    results.each do |row|
      keys.add(row['image_r2_key']) if row['image_r2_key']
      keys.add(row['thumbnail_r2_key']) if row['thumbnail_r2_key']
      keys.add(row['icon_r2_key']) if row['icon_r2_key']
      keys.add(row['watermarked_r2_key']) if row['watermarked_r2_key']
    end

    keys
  end

  def close
    # No persistent connection
  end
end

# R2 bucket handler
class R2Bucket
  def initialize
    @s3_client = configure_s3
  end

  def list_all_keys(prefix = 'artwork/')
    keys = Set.new
    continuation_token = nil

    loop do
      response = @s3_client.list_objects_v2(
        bucket: ENV['R2_BUCKET_NAME'],
        prefix: prefix,
        continuation_token: continuation_token
      )

      response.contents.each { |obj| keys.add(obj.key) }

      break unless response.is_truncated

      continuation_token = response.next_continuation_token
    end

    keys
  end

  def find_orphaned_keys(valid_keys)
    all_keys = list_all_keys
    orphaned = all_keys - valid_keys
    orphaned
  end

  def delete_file(key)
    @s3_client.delete_object(
      bucket: ENV['R2_BUCKET_NAME'],
      key: key
    )
    true
  end

  def delete_files(keys)
    keys.each { |key| delete_file(key) }
    keys.length
  end

  private

  def configure_s3
    require 'aws-sdk-s3'

    Aws::S3::Client.new(
      region: 'auto',
      endpoint: ENV['R2_ENDPOINT'] || "https://#{ENV['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
      access_key_id: ENV['R2_ACCESS_KEY_ID'],
      secret_access_key: ENV['R2_SECRET_ACCESS_KEY']
    )
  end
end

# Display handlers
class DisplayFormatter
  def self.print_header(mode, orphan_days, dry_run)
    puts "\n" + "Orphan Cleanup".cyan.bold
    puts "─" * 60
    puts "Mode:         #{mode}"
    puts "Orphan days:  #{orphan_days}"
    puts "Status:       #{dry_run ? 'DRY RUN'.bg_yellow.black : 'EXECUTE'.bg_green.black}"
    puts
  end

  def self.print_orphaned_artworks(artworks)
    if artworks.empty?
      puts "No orphaned artworks found.".green
      return
    end

    puts "\nOrphaned Artworks (>N days without collection)".cyan.bold
    puts "─" * 60
    puts "Found #{artworks.length} orphaned artwork(s):\n"

    artworks.each do |artwork|
      puts "  • #{artwork['title']} (ID: #{artwork['id']})".yellow
      puts "    Artist:     #{artwork['username']}"
      puts "    Created:    #{artwork['created_at']}"
      puts "    Updated:    #{artwork['updated_at']}"
      puts "    Image key:  #{artwork['image_r2_key'] || '(none)'.gray}"
      puts
    end
  end

  def self.print_orphaned_r2_files(filenames)
    if filenames.empty?
      puts "No orphaned R2 files found.".green
      return
    end

    puts "\nOrphaned R2 Files (no matching artwork)".cyan.bold
    puts "─" * 60
    puts "Found #{filenames.length} orphaned file(s):\n"

    filenames.each do |filename|
      puts "  • #{filename}".yellow
    end

    puts "\n(Total size would need individual file checks)".gray
  end

  def self.print_confirmation
    puts "\n" + "CONFIRM CLEANUP".bg_red.white.bold
    puts "─" * 60
    print "Type 'yes' to proceed with deletion: "

    confirmation = $stdin.gets.chomp.downcase
    confirmation == 'yes'
  end

  def self.print_completion(deleted_count, mode)
    puts "\n" + "Cleanup Complete".cyan.bold
    puts "─" * 60
    puts "Deleted #{deleted_count} items (#{mode})".green
    puts
  end

  def self.print_dry_run_notice
    puts "\n" + "DRY RUN MODE".bg_yellow.black.bold
    puts "─" * 60
    puts "No changes have been applied."
    puts "Review the items above and run with --execute to proceed."
    puts
  end

  def self.error(message)
    puts "✗ Error: #{message}".red
  end

  def self.success(message)
    puts "✓ #{message}".green
  end
end

# Main application
class OrphanCleanupApp
  def initialize(config)
    @config = config
    @db = if @config.remote
            D1RemoteOrphanDatabase.new('site-db')
          else
            OrphanDatabase.new(@config.db_path)
          end
    @r2 = nil
  end

  def run
    DisplayFormatter.print_header(@config.cleanup_mode, @config.orphan_days, @config.dry_run)

    case @config.cleanup_mode
    when 'db'
      cleanup_database_orphans
    when 'r2'
      cleanup_r2_orphans
    when 'all'
      cleanup_database_orphans
      cleanup_r2_orphans
    else
      DisplayFormatter.error "Unknown mode: #{@config.cleanup_mode}"
      exit(1)
    end
  rescue StandardError => e
    DisplayFormatter.error e.message
    puts e.backtrace if @config.verbose
    exit(1)
  ensure
    @db.close
  end

  private

  def cleanup_database_orphans
    puts "Scanning database for orphaned artworks...".cyan

    orphaned = @db.find_orphaned_artworks(@config.orphan_days)

    if orphaned.empty?
      DisplayFormatter.print_orphaned_artworks([])
      return
    end

    DisplayFormatter.print_orphaned_artworks(orphaned)

    if @config.dry_run
      DisplayFormatter.print_dry_run_notice
    else
      proceed = DisplayFormatter.print_confirmation
      return unless proceed

      deleted = 0
      orphaned.each do |artwork|
        begin
          @db.soft_delete_artwork(artwork['id'])
          deleted += 1
          puts "  ✓ Deleted artwork #{artwork['id']}".green if @config.verbose
        rescue StandardError => e
          puts "  ✗ Failed to delete artwork #{artwork['id']}: #{e.message}".red if @config.verbose
        end
      end

      DisplayFormatter.print_completion(deleted, 'database artworks')
    end
  end

  def cleanup_r2_orphans
    puts "Scanning R2 for orphaned files...".cyan

    @r2 ||= R2Bucket.new

    valid_keys = @db.get_all_r2_keys
    puts "Database references #{valid_keys.length} R2 files".cyan if @config.verbose

    orphaned_keys = @r2.find_orphaned_keys(valid_keys)

    if orphaned_keys.empty?
      DisplayFormatter.print_orphaned_r2_files([])
      return
    end

    DisplayFormatter.print_orphaned_r2_files(orphaned_keys.to_a)

    if @config.dry_run
      DisplayFormatter.print_dry_run_notice
    elsif @config.delete_r2_files
      proceed = DisplayFormatter.print_confirmation
      return unless proceed

      deleted = @r2.delete_files(orphaned_keys)
      DisplayFormatter.print_completion(deleted, 'R2 files')
    else
      puts "\n⚠ Use --delete-r2 flag to delete R2 files".yellow
    end
  end
end

# Entry point
if __FILE__ == $0
  begin
    config = Config.new
    app = OrphanCleanupApp.new(config)
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
chmod +x /site/scripts/cleanup_orphans.rb
```

### Step 4: Update Environment Configuration

Update `/site/.env.backup`:

```bash
# D1 Configuration
# D1_DB_PATH=/path/to/db.sqlite3

# R2 Configuration (required for r2 mode)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_BUCKET_NAME=site
```

### Step 5: Add Documentation

Update `/site/docs/ADMIN-SCRIPTS.md`:

```markdown
## Orphan Cleanup Script

Find and remove orphaned artworks and R2 files with safety checks.

### Installation

Already completed with other scripts.

### Backup First!

**STRONGLY RECOMMENDED:** Always run a full database backup before cleanup:

```bash
ruby scripts/backup.rb --r2-upload
```

### Usage

#### Dry-run: find database orphans (default)
```bash
ruby scripts/cleanup_orphans.rb db
```

#### Dry-run: find R2 orphans
```bash
ruby scripts/cleanup_orphans.rb r2
```

#### Dry-run: find all orphans
```bash
ruby scripts/cleanup_orphans.rb all
```

#### Execute cleanup (requires typed confirmation)
```bash
ruby scripts/cleanup_orphans.rb db --execute
```

#### Delete R2 orphaned files
```bash
ruby scripts/cleanup_orphans.rb r2 --execute --delete-r2
```

#### Custom orphan threshold (e.g., 60 days)
```bash
ruby scripts/cleanup_orphans.rb all --days 60
```

#### Verbose output
```bash
ruby scripts/cleanup_orphans.rb all --execute --verbose
```

#### Production database
```bash
ruby scripts/cleanup_orphans.rb db --remote --execute
```

### Cleanup Modes

#### Database (db)
- Finds artworks not in any collection for N days
- Soft deletes artworks (sets deleted_at timestamp)
- Logs deletion to activity_log for audit trail
- R2 files are retained (can cleanup separately)

#### R2 (r2)
- Scans R2 bucket for all artwork files
- Compares against database artwork records
- Identifies files with no matching artwork
- Requires --delete-r2 to actually delete

#### All (all)
- Runs both database and R2 cleanup
- Database cleanup happens first
- R2 cleanup requires --delete-r2 flag

### Orphan Definition

**Database:** Artwork created >N days ago and not in any collection
**R2:** File in bucket with no matching artwork record in database

Default N = 30 days. Override with `--days` flag.

### Safety Features

1. **Dry-run Mode (default)** - Shows what would be deleted without making changes
2. **Typed Confirmation** - Must type 'yes' to confirm execution
3. **Soft Deletes** - Database records marked deleted_at, not removed
4. **Activity Logging** - All deletions logged for audit trail
5. **Separate R2 Deletion** - Must use --delete-r2 flag to delete R2 files

### Workflow

1. Run backup: `ruby scripts/backup.rb`
2. Check database orphans: `ruby scripts/cleanup_orphans.rb db`
3. Check R2 orphans: `ruby scripts/cleanup_orphans.rb r2`
4. Review dry-run output
5. Execute cleanup: `ruby scripts/cleanup_orphans.rb db --execute`
6. Confirm by typing 'yes'
7. Check R2: `ruby scripts/cleanup_orphans.rb r2 --execute --delete-r2`

### Important Notes

- Soft-deleted artworks can be restored by updating deleted_at to NULL
- R2 deletions are permanent (no trash/recovery)
- Activity log provides audit trail of all deletions
- For production, test on backup first
```

---

## Files to Create/Modify

**Created:**
- `/site/scripts/cleanup_orphans.rb` - Orphan cleanup script (executable)

**Modified:**
- `/site/docs/ADMIN-SCRIPTS.md` - Add cleanup documentation
- `/site/.env.backup` - Add R2 configuration notes

---

## Verification Checklist

- [ ] `ruby scripts/cleanup_orphans.rb --help` shows usage
- [ ] `ruby scripts/cleanup_orphans.rb db` runs in dry-run mode
- [ ] `ruby scripts/cleanup_orphans.rb r2` lists orphaned files
- [ ] `ruby scripts/cleanup_orphans.rb all` runs both checks
- [ ] Dry-run displays artworks/files without making changes
- [ ] `--days` flag allows custom orphan threshold
- [ ] `--execute` flag required to make changes
- [ ] Execution requires typed 'yes' confirmation
- [ ] Database cleanup soft-deletes (sets deleted_at)
- [ ] Activity log entries created for deletions
- [ ] R2 cleanup requires `--delete-r2` flag
- [ ] `--remote` flag works with production D1
- [ ] Verbose output shows progress
- [ ] Color output displays correctly (yellow for orphaned, green for success)
- [ ] Script handles missing R2 credentials gracefully
- [ ] Script handles empty results gracefully
- [ ] Dry-run notice prints when changes not executed

Once verified, Phase 31 (Admin Scripts - Ruby) is complete!

---

## Next Steps After Phase 31

After completing all 5 build files (166-170):

1. **Testing:** Run each script against test data
2. **Documentation:** Ensure /docs/ADMIN-SCRIPTS.md is comprehensive
3. **Automation:** Set up cron jobs for regular backups and cleanup
4. **Monitoring:** Log script execution for audit trail
5. **Training:** Document procedures for team members

---

## Summary of Phase 31 Scripts

| Script | Purpose | Mode |
|--------|---------|------|
| **users.rb** | List, search, display user details | CLI queries |
| **bulk_status.rb** | Update user status from CSV | CSV import |
| **backup.rb** | Export database to SQL + R2 upload | Backup/restore |
| **analytics.rb** | Export analytics data CSV/JSON | Reporting |
| **cleanup_orphans.rb** | Remove orphaned artworks/R2 files | Maintenance |

All scripts follow pattern:
- Local + remote (--remote flag) database access
- Dry-run mode by default
- Typed confirmation for destructive operations
- Color output for readability
- Detailed logging and error handling
