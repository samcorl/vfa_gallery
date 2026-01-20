# 167-SCRIPT-BULK-STATUS.md
## Bulk User Status Update Script

**Goal:** Create a Ruby script to update user status in bulk from a CSV file, with dry-run mode to preview changes before applying.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **User Status:** Tracks account state (active, suspended, pending_review, deleted)
- **Admin Functions:** Admins can modify user statuses for moderation/compliance
- **Database:** CloudFlare D1 (SQLite-compatible)

---

## Prerequisites

**Must Complete First:**
- 04-D1-DATABASE-INIT.md ✓
- 06-SCHEMA-USERS.md ✓
- 166-SCRIPT-USER-MANAGEMENT.md ✓ (optional, for context)

**Local Requirements:**
- Ruby 3.0+ installed
- Gems: `sqlite3`, `csv`, `optparse`, `colorize`, `tty-table`
- Sample CSV file with user IDs and new status values

---

## Steps

### Step 1: Prepare CSV Format

Create a sample CSV file at `/vfa-gallery/scripts/samples/bulk_status_template.csv`:

```bash
mkdir -p /vfa-gallery/scripts/samples
```

Create `/vfa-gallery/scripts/samples/bulk_status_template.csv`:

```csv
user_id,new_status,reason
1,suspended,"Spam activity detected"
5,suspended,"Violates terms of service"
12,active,"Appeal approved"
42,pending_review,"Manual review requested"
99,suspended,"Account takeover suspected"
```

**CSV Format Rules:**
- **user_id**: Numeric user ID (must exist in database)
- **new_status**: One of: `active`, `suspended`, `pending_review`, `deleted`
- **reason**: Admin note explaining the status change (required for auditing)

### Step 2: Create Bulk Status Script

Create `/vfa-gallery/scripts/bulk_status.rb`:

```ruby
#!/usr/bin/env ruby

require 'sqlite3'
require 'csv'
require 'optparse'
require 'colorize'
require 'tty-table'
require 'time'

# Configuration
class Config
  VALID_STATUSES = ['active', 'suspended', 'pending_review', 'deleted'].freeze

  attr_reader :db_path, :csv_file, :dry_run, :verbose, :skip_validation, :remote

  def initialize
    @db_path = ENV['D1_DB_PATH'] || File.expand_path('../.wrangler/state/d1/db/vfa-gallery-db.sqlite3', __dir__)
    @csv_file = nil
    @dry_run = true  # Default to dry-run for safety
    @verbose = false
    @skip_validation = false
    @remote = false

    parse_options
  end

  def parse_options
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: ruby scripts/bulk_status.rb [OPTIONS]"

      opts.on('-f', '--file FILE', 'CSV file with user_id, new_status, reason columns') do |file|
        @csv_file = file
      end

      opts.on('--execute', 'Execute the changes (without this flag, runs in dry-run mode)') do
        @dry_run = false
      end

      opts.on('-v', '--verbose', 'Show detailed output') do
        @verbose = true
      end

      opts.on('--skip-validation', 'Skip user existence check (faster, riskier)') do
        @skip_validation = true
      end

      opts.on('-r', '--remote', 'Use remote D1 database (production)') do
        @remote = true
      end

      opts.on('-h', '--help', 'Show this help message') do
        puts opts
        puts "\nValid statuses: #{VALID_STATUSES.join(', ')}"
        puts "\nExample CSV (bulk_status_template.csv):"
        puts "  user_id,new_status,reason"
        puts "  1,suspended,\"Spam activity\""
        puts "  5,active,\"Appeal approved\""
        exit(0)
      end
    end

    parser.parse!

    # Validate required arguments
    if @csv_file.nil?
      puts "Error: --file is required".red
      exit(1)
    end

    unless File.exist?(@csv_file)
      puts "Error: File not found: #{@csv_file}".red
      exit(1)
    end
  end
end

# CSV parsing and validation
class BulkStatusCSV
  def initialize(file_path, valid_statuses)
    @file_path = file_path
    @valid_statuses = valid_statuses
    @rows = []
    @errors = []

    parse_csv
  end

  def valid?
    @errors.empty?
  end

  def rows
    @rows
  end

  def errors
    @errors
  end

  private

  def parse_csv
    row_num = 0

    CSV.foreach(@file_path, headers: true) do |row|
      row_num += 1

      # Skip empty rows
      next if row.all? { |_k, v| v.nil? || v.strip.empty? }

      begin
        user_id = row['user_id']&.strip
        new_status = row['new_status']&.strip&.downcase
        reason = row['reason']&.strip

        # Validation
        errors = validate_row(row_num, user_id, new_status, reason)
        if errors.any?
          @errors.concat(errors)
          next
        end

        @rows << {
          row: row_num,
          user_id: user_id.to_i,
          new_status: new_status,
          reason: reason
        }
      rescue StandardError => e
        @errors << "Row #{row_num}: Parsing error: #{e.message}"
      end
    end
  end

  def validate_row(row_num, user_id, new_status, reason)
    errors = []

    if user_id.nil? || user_id.empty?
      errors << "Row #{row_num}: user_id is required"
      return errors
    end

    unless user_id.match?(/^\d+$/)
      errors << "Row #{row_num}: user_id must be numeric, got '#{user_id}'"
      return errors
    end

    if new_status.nil? || new_status.empty?
      errors << "Row #{row_num}: new_status is required"
      return errors
    end

    unless @valid_statuses.include?(new_status)
      errors << "Row #{row_num}: invalid status '#{new_status}'. Valid: #{@valid_statuses.join(', ')}"
      return errors
    end

    if reason.nil? || reason.empty?
      errors << "Row #{row_num}: reason is required (for audit trail)"
    end

    errors
  end
end

# Database handler
class UserDatabase
  def initialize(db_path)
    @db = SQLite3::Database.new db_path
    @db.results_as_hash = true
    @db.type_translation = true
  end

  def user_exists?(user_id)
    result = @db.execute('SELECT id FROM users WHERE id = ?', [user_id])
    result.any?
  end

  def get_user_current_status(user_id)
    result = @db.execute(
      'SELECT id, username, status FROM users WHERE id = ?',
      [user_id]
    )
    result.first if result.any?
  end

  def update_user_status(user_id, new_status, reason)
    now = Time.now.iso8601

    @db.execute(
      <<~SQL,
        UPDATE users
        SET status = ?, updated_at = ?
        WHERE id = ?
      SQL
      [new_status, now, user_id]
    )

    # Log to activity log for audit trail
    @db.execute(
      <<~SQL,
        INSERT INTO activity_log (user_id, action, details, created_at)
        VALUES (?, ?, ?, ?)
      SQL
      [user_id, 'status_changed', "Status changed to #{new_status}. Reason: #{reason}", now]
    )

    true
  end

  def close
    @db.close
  end
end

# Remote D1 access
class D1RemoteDatabase
  def initialize(database_name)
    @database_name = database_name
    require_relative 'lib/d1_helper'
  end

  def user_exists?(user_id)
    query = "SELECT id FROM users WHERE id = #{user_id};"
    result = D1Helper.execute_query(@database_name, query, remote: true)
    Array(result).any?
  end

  def get_user_current_status(user_id)
    query = "SELECT id, username, status FROM users WHERE id = #{user_id};"
    result = D1Helper.execute_query(@database_name, query, remote: true)
    Array(result).first
  end

  def update_user_status(user_id, new_status, reason)
    now = Time.now.iso8601

    update_query = "UPDATE users SET status = '#{new_status}', updated_at = '#{now}' WHERE id = #{user_id};"
    D1Helper.execute_query(@database_name, update_query, remote: true)

    log_query = "INSERT INTO activity_log (user_id, action, details, created_at) VALUES (#{user_id}, 'status_changed', 'Status changed to #{new_status}. Reason: #{reason}', '#{now}');"
    D1Helper.execute_query(@database_name, log_query, remote: true)

    true
  end

  def close
    # No persistent connection
  end
end

# Display handlers
class DisplayFormatter
  def self.print_header
    puts "\n" + "Bulk User Status Update".cyan.bold
    puts "─" * 60
    puts
  end

  def self.print_summary(total, valid, invalid, dry_run)
    puts "\nSummary".cyan.bold
    puts "─" * 60
    puts "Total rows:      #{total}"
    puts "Valid rows:      #{valid.green}"
    puts "Invalid rows:    #{invalid > 0 ? invalid.to_s.red : invalid.to_s.green}"

    if dry_run
      puts "\nMode:            #{' DRY RUN (no changes will be made) '.bg_yellow.black}"
    else
      puts "\nMode:            #{' EXECUTE (changes will be applied) '.bg_green.black}"
    end
    puts
  end

  def self.print_errors(errors)
    puts "\nValidation Errors".red.bold
    puts "─" * 60

    errors.each do |error|
      puts "  ✗ #{error}"
    end
    puts
  end

  def self.print_plan(rows)
    if rows.empty?
      puts "No valid rows to process.".yellow
      return
    end

    puts "\nUpdate Plan".cyan.bold
    puts "─" * 60

    table_rows = rows.map do |row|
      [
        row[:user_id].to_s,
        row[:new_status],
        row[:reason]
      ]
    end

    table = TTY::Table.new(
      header: ['User ID', 'New Status', 'Reason'],
      rows: table_rows
    )

    puts table.render(:unicode)
  end

  def self.print_details(rows, database)
    puts "\nDetailed Changes".cyan.bold
    puts "─" * 60

    rows.each do |row|
      current = database.get_user_current_status(row[:user_id])

      if current
        puts "\nUser ##{row[:user_id]} (#{current['username']})"
        puts "  Current status:  #{current['status'].yellow}"
        puts "  New status:      #{row[:new_status].green}"
        puts "  Reason:          #{row[:reason]}"
      else
        puts "\nUser ##{row[:user_id]}"
        puts "  Status:          #{'NOT FOUND'.red}"
      end
    end
    puts
  end

  def self.print_confirmation
    puts "\n" + "CONFIRM EXECUTION".bg_red.white.bold
    puts "─" * 60
    print "Type 'yes' to proceed with updates: "

    confirmation = $stdin.gets.chomp.downcase

    confirmation == 'yes'
  end

  def self.print_progress(index, total)
    printf "\rProcessing: %d/%d", index, total
    $stdout.flush
  end

  def self.print_completion(succeeded, failed, failed_ids)
    puts "\n\n" + "Completion Report".cyan.bold
    puts "─" * 60
    puts "Successfully updated: #{succeeded.to_s.green}"

    if failed > 0
      puts "Failed updates:       #{failed.to_s.red}"
      puts "\nFailed user IDs:"
      failed_ids.each { |id| puts "  - #{id}".red }
    end
    puts
  end

  def self.print_dry_run_notice
    puts "\n" + "DRY RUN MODE".bg_yellow.black.bold
    puts "─" * 60
    puts "No changes have been applied to the database."
    puts "Review the plan above and run with --execute to apply changes."
    puts
  end

  def self.error(message)
    puts "Error: #{message}".red
  end

  def self.success(message)
    puts message.green
  end
end

# Main application
class BulkStatusApp
  def initialize(config)
    @config = config
    @csv = BulkStatusCSV.new(config.csv_file, Config::VALID_STATUSES)
  end

  def run
    DisplayFormatter.print_header

    # Validate CSV
    unless @csv.valid?
      DisplayFormatter.print_errors(@csv.errors)
      exit(1)
    end

    DisplayFormatter.print_summary(
      @csv.rows.length + @csv.errors.length,
      @csv.rows.length,
      @csv.errors.length,
      @config.dry_run
    )

    # Initialize database
    @db = if @config.remote
            D1RemoteDatabase.new('vfa-gallery-db')
          else
            UserDatabase.new(@config.db_path)
          end

    # Validate users exist
    unless @config.skip_validation
      puts "Validating users...".cyan
      valid_rows = validate_users(@csv.rows)

      if valid_rows.length < @csv.rows.length
        DisplayFormatter.success "#{valid_rows.length}/#{@csv.rows.length} users found"
      else
        DisplayFormatter.success "All #{@csv.rows.length} users found"
      end

      @csv.rows = valid_rows
    end

    # Show plan
    DisplayFormatter.print_plan(@csv.rows)

    if @config.verbose
      DisplayFormatter.print_details(@csv.rows, @db)
    end

    # Execute or preview
    if @config.dry_run
      DisplayFormatter.print_dry_run_notice
    else
      proceed = DisplayFormatter.print_confirmation
      exit(0) unless proceed

      execute_updates
    end
  rescue StandardError => e
    DisplayFormatter.error "#{e.message}"
    puts e.backtrace if @config.verbose
    exit(1)
  ensure
    @db&.close
  end

  private

  def validate_users(rows)
    valid_rows = []

    rows.each do |row|
      if @db.user_exists?(row[:user_id])
        valid_rows << row
      else
        DisplayFormatter.error "User ##{row[:user_id]} not found"
      end
    end

    valid_rows
  end

  def execute_updates
    puts "\n" + "Executing updates...".cyan
    succeeded = 0
    failed = 0
    failed_ids = []

    @csv.rows.each_with_index do |row, index|
      DisplayFormatter.print_progress(index + 1, @csv.rows.length)

      begin
        @db.update_user_status(row[:user_id], row[:new_status], row[:reason])
        succeeded += 1
      rescue StandardError => e
        failed += 1
        failed_ids << row[:user_id]
        puts "\n  ✗ User ##{row[:user_id]}: #{e.message}".red if @config.verbose
      end
    end

    DisplayFormatter.print_completion(succeeded, failed, failed_ids)

    if failed > 0
      exit(1)
    end
  end
end

# Entry point
if __FILE__ == $0
  begin
    config = Config.new
    app = BulkStatusApp.new(config)
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
chmod +x /vfa-gallery/scripts/bulk_status.rb
```

### Step 4: Create Activity Log Table (if not already present)

The script assumes an `activity_log` table exists. Verify in your schema file or migration.

Expected schema:
```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

This should be created in build file **13-SCHEMA-SUPPORTING.md**.

### Step 5: Create Test CSV

Create `/vfa-gallery/scripts/samples/bulk_status_test.csv`:

```csv
user_id,new_status,reason
999999,suspended,"Nonexistent user for testing"
1,suspended,"Test suspension"
2,active,"Test activation"
```

### Step 6: Add Documentation to Admin Scripts Guide

Update `/vfa-gallery/docs/ADMIN-SCRIPTS.md` with:

```markdown
## Bulk User Status Update Script

Update user statuses in bulk from a CSV file with dry-run preview.

### Installation

Already completed with user management script.

### Usage

#### Dry-run mode (preview only, default)
```bash
ruby scripts/bulk_status.rb --file scripts/samples/bulk_status.csv
```

#### Execute changes after reviewing
```bash
ruby scripts/bulk_status.rb --file scripts/samples/bulk_status.csv --execute
```

#### Execute with verbose output
```bash
ruby scripts/bulk_status.rb --file scripts/samples/bulk_status.csv --execute --verbose
```

#### Skip user validation for speed
```bash
ruby scripts/bulk_status.rb --file scripts/samples/bulk_status.csv --skip-validation --execute
```

#### Use production database
```bash
ruby scripts/bulk_status.rb --file scripts/samples/bulk_status.csv --remote
```

### CSV Format

Required columns: `user_id`, `new_status`, `reason`

Valid statuses:
- `active` - User account is active
- `suspended` - User account is suspended
- `pending_review` - Account requires manual review
- `deleted` - Account marked as deleted (soft delete)

### Example CSV

```csv
user_id,new_status,reason
5,suspended,"Violates community guidelines"
12,active,"Appeal approved"
42,pending_review,"Suspicious activity pattern"
```

### Workflow

1. Create CSV file with changes
2. Run with dry-run to preview (default)
3. Review the plan
4. Run with `--execute` flag
5. Confirm by typing 'yes'
6. Changes logged to activity_log table

### Audit Trail

Every status change is logged to `activity_log` table with:
- user_id
- action: 'status_changed'
- details: reason provided
- created_at: timestamp
```

---

## Files to Create/Modify

**Created:**
- `/vfa-gallery/scripts/bulk_status.rb` - Bulk status update script (executable)
- `/vfa-gallery/scripts/samples/bulk_status_template.csv` - CSV template
- `/vfa-gallery/scripts/samples/bulk_status_test.csv` - Test data

**Modified:**
- `/vfa-gallery/docs/ADMIN-SCRIPTS.md` - Add bulk status documentation

---

## Verification Checklist

- [ ] `ruby scripts/bulk_status.rb --help` shows usage
- [ ] Script requires `--file` argument and shows error if missing
- [ ] Dry-run mode displays update plan without making changes
- [ ] CSV validation catches invalid user IDs
- [ ] CSV validation catches invalid status values
- [ ] CSV validation requires reason column
- [ ] `--skip-validation` flag skips existence check
- [ ] User validation confirms users exist before updates
- [ ] Detailed view shows current vs new status
- [ ] Dry-run prints notice that no changes were made
- [ ] `--execute` flag requires typed confirmation
- [ ] Updates are reflected in database when executed
- [ ] Activity log entries created for each update
- [ ] Failed updates are reported clearly
- [ ] Color output displays (yellow for dry-run, green for success, red for errors)
- [ ] `--remote` flag works with production D1

Once verified, proceed to **168-SCRIPT-DB-BACKUP.md**.
