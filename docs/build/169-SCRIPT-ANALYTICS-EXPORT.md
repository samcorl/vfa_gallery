# 169-SCRIPT-ANALYTICS-EXPORT.md
## Analytics Export Script

**Goal:** Create a Ruby script to export analytics data including user signups over time, uploads per day, and popular categories to CSV or JSON format with date range filtering.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Database:** CloudFlare D1 (SQLite-compatible)
- **Rate Limits:** Track uploads per day and time-based metrics
- **Content:** Categories, collections, artwork uploads tracked

---

## Prerequisites

**Must Complete First:**
- 04-D1-DATABASE-INIT.md ✓
- 06-SCHEMA-USERS.md ✓
- 10-SCHEMA-ARTWORKS.md ✓
- 11-SCHEMA-THEMES.md ✓ (for categories)
- 13-SCHEMA-SUPPORTING.md ✓ (for activity log)

**Local Requirements:**
- Ruby 3.0+ installed
- Gems: `sqlite3`, `csv`, `json`, `optparse`, `colorize`

---

## Steps

### Step 1: Create Analytics Export Script

Create `/site/scripts/analytics.rb`:

```ruby
#!/usr/bin/env ruby

require 'sqlite3'
require 'csv'
require 'json'
require 'optparse'
require 'colorize'
require 'date'

# Configuration
class Config
  attr_reader :db_path, :output_format, :start_date, :end_date, :output_file, :metric, :remote

  def initialize
    @db_path = ENV['D1_DB_PATH'] || File.expand_path('../.wrangler/state/d1/db/site-db.sqlite3', __dir__)
    @output_format = 'json'
    @start_date = (Date.today - 30).to_s
    @end_date = Date.today.to_s
    @output_file = nil
    @metric = nil
    @remote = false

    parse_options
  end

  private

  def parse_options
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: ruby scripts/analytics.rb [METRIC] [OPTIONS]"

      opts.on('signups', 'Export user signups over time') do
        @metric = 'signups'
      end

      opts.on('uploads', 'Export uploads per day') do
        @metric = 'uploads'
      end

      opts.on('categories', 'Export popular categories') do
        @metric = 'categories'
      end

      opts.on('all', 'Export all metrics') do
        @metric = 'all'
      end

      opts.on('-f', '--format FORMAT', ['csv', 'json'], 'Output format: csv or json (default: json)') do |format|
        @output_format = format
      end

      opts.on('-s', '--start DATE', 'Start date (YYYY-MM-DD, default: 30 days ago)') do |date|
        @start_date = date
      end

      opts.on('-e', '--end DATE', 'End date (YYYY-MM-DD, default: today)') do |date|
        @end_date = date
      end

      opts.on('-o', '--output FILE', 'Output file (default: analytics_[metric]_[timestamp].[format])') do |file|
        @output_file = file
      end

      opts.on('-r', '--remote', 'Use remote D1 database (production)') do
        @remote = true
      end

      opts.on('-h', '--help', 'Show this help message') do
        puts opts
        puts "\nMetrics:"
        puts "  signups      - User registrations over time"
        puts "  uploads      - Artwork uploads per day"
        puts "  categories   - Popular artwork categories/themes"
        puts "  all          - All metrics"
        puts "\nExamples:"
        puts "  ruby scripts/analytics.rb signups"
        puts "  ruby scripts/analytics.rb uploads --start 2024-01-01 --end 2024-01-31 --format csv"
        puts "  ruby scripts/analytics.rb all --format json"
        exit(0)
      end
    end

    parser.parse!

    if @metric.nil?
      puts "Error: metric is required (signups, uploads, categories, or all)".red
      exit(1)
    end

    # Validate dates
    begin
      Date.parse(@start_date)
      Date.parse(@end_date)
    rescue StandardError => e
      puts "Error: invalid date format. Use YYYY-MM-DD: #{e.message}".red
      exit(1)
    end

    if @start_date > @end_date
      puts "Error: start_date must be before end_date".red
      exit(1)
    end
  end
end

# Database handler
class AnalyticsDatabase
  def initialize(db_path)
    @db = SQLite3::Database.new db_path
    @db.results_as_hash = true
    @db.type_translation = true
  end

  def signups_by_date(start_date, end_date)
    query = <<~SQL
      SELECT
        DATE(created_at) as signup_date,
        COUNT(*) as signup_count,
        CAST(COUNT(*) as REAL) as rolling_total
      FROM users
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY signup_date ASC
    SQL

    @db.execute(query, [start_date, end_date])
  end

  def total_signups_by_date(start_date, end_date)
    query = <<~SQL
      SELECT
        DATE(created_at) as signup_date,
        COUNT(*) OVER (ORDER BY DATE(created_at)) as cumulative_signups
      FROM users
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY signup_date ASC
    SQL

    @db.execute(query, [start_date, end_date])
  end

  def uploads_by_date(start_date, end_date)
    query = <<~SQL
      SELECT
        DATE(created_at) as upload_date,
        COUNT(*) as upload_count,
        COUNT(DISTINCT user_id) as unique_uploaders,
        ROUND(AVG(CAST(LENGTH(title) as REAL)), 1) as avg_title_length
      FROM artworks
      WHERE DATE(created_at) BETWEEN ? AND ?
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY upload_date ASC
    SQL

    @db.execute(query, [start_date, end_date])
  end

  def popular_categories(start_date, end_date, limit = 20)
    query = <<~SQL
      SELECT
        t.name as category,
        COUNT(DISTINCT a.id) as artwork_count,
        COUNT(DISTINCT a.user_id) as artist_count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM artworks
          WHERE DATE(created_at) BETWEEN ? AND ? AND deleted_at IS NULL), 2) as percentage
      FROM artworks a
      LEFT JOIN themes t ON a.theme_id = t.id
      WHERE DATE(a.created_at) BETWEEN ? AND ?
        AND a.deleted_at IS NULL
      GROUP BY a.theme_id, t.name
      ORDER BY artwork_count DESC
      LIMIT ?
    SQL

    @db.execute(query, [start_date, end_date, start_date, end_date, limit])
  end

  def uploads_by_artist(start_date, end_date, limit = 20)
    query = <<~SQL
      SELECT
        u.username,
        COUNT(*) as upload_count,
        COUNT(DISTINCT a.collection_id) as collection_count
      FROM artworks a
      JOIN users u ON a.user_id = u.id
      WHERE DATE(a.created_at) BETWEEN ? AND ?
        AND a.deleted_at IS NULL
      GROUP BY a.user_id, u.username
      ORDER BY upload_count DESC
      LIMIT ?
    SQL

    @db.execute(query, [start_date, end_date, limit])
  end

  def engagement_summary(start_date, end_date)
    {
      new_users: @db.execute(
        "SELECT COUNT(*) as count FROM users WHERE DATE(created_at) BETWEEN ? AND ? AND status != 'deleted'",
        [start_date, end_date]
      ).first['count'],
      new_artworks: @db.execute(
        "SELECT COUNT(*) as count FROM artworks WHERE DATE(created_at) BETWEEN ? AND ? AND deleted_at IS NULL",
        [start_date, end_date]
      ).first['count'],
      new_galleries: @db.execute(
        "SELECT COUNT(*) as count FROM galleries WHERE DATE(created_at) BETWEEN ? AND ? AND deleted_at IS NULL",
        [start_date, end_date]
      ).first['count'],
      new_collections: @db.execute(
        "SELECT COUNT(*) as count FROM collections WHERE DATE(created_at) BETWEEN ? AND ? AND deleted_at IS NULL",
        [start_date, end_date]
      ).first['count'],
      total_users: @db.execute(
        "SELECT COUNT(*) as count FROM users WHERE status != 'deleted'"
      ).first['count'],
      total_artworks: @db.execute(
        "SELECT COUNT(*) as count FROM artworks WHERE deleted_at IS NULL"
      ).first['count']
    }
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

  def signups_by_date(start_date, end_date)
    query = "SELECT DATE(created_at) as signup_date, COUNT(*) as signup_count FROM users WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND status != 'deleted' GROUP BY DATE(created_at) ORDER BY signup_date ASC;"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def uploads_by_date(start_date, end_date)
    query = "SELECT DATE(created_at) as upload_date, COUNT(*) as upload_count, COUNT(DISTINCT user_id) as unique_uploaders FROM artworks WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND deleted_at IS NULL GROUP BY DATE(created_at) ORDER BY upload_date ASC;"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def popular_categories(start_date, end_date, limit = 20)
    query = "SELECT t.name as category, COUNT(DISTINCT a.id) as artwork_count, COUNT(DISTINCT a.user_id) as artist_count FROM artworks a LEFT JOIN themes t ON a.theme_id = t.id WHERE DATE(a.created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND a.deleted_at IS NULL GROUP BY a.theme_id, t.name ORDER BY artwork_count DESC LIMIT #{limit};"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def uploads_by_artist(start_date, end_date, limit = 20)
    query = "SELECT u.username, COUNT(*) as upload_count FROM artworks a JOIN users u ON a.user_id = u.id WHERE DATE(a.created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND a.deleted_at IS NULL GROUP BY a.user_id, u.username ORDER BY upload_count DESC LIMIT #{limit};"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def engagement_summary(start_date, end_date)
    {
      new_users: Array(D1Helper.execute_query(@database_name, "SELECT COUNT(*) as count FROM users WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND status != 'deleted';", remote: true)).first['count'],
      new_artworks: Array(D1Helper.execute_query(@database_name, "SELECT COUNT(*) as count FROM artworks WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND deleted_at IS NULL;", remote: true)).first['count'],
      new_galleries: Array(D1Helper.execute_query(@database_name, "SELECT COUNT(*) as count FROM galleries WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND deleted_at IS NULL;", remote: true)).first['count'],
      new_collections: Array(D1Helper.execute_query(@database_name, "SELECT COUNT(*) as count FROM collections WHERE DATE(created_at) BETWEEN '#{start_date}' AND '#{end_date}' AND deleted_at IS NULL;", remote: true)).first['count']
    }
  end

  def close
    # No persistent connection
  end
end

# Output handlers
class OutputWriter
  def self.write_csv(filename, data, headers)
    CSV.open(filename, 'w') do |csv|
      csv << headers
      data.each { |row| csv << row.values_at(*headers) }
    end
  end

  def self.write_json(filename, data)
    File.write(filename, JSON.pretty_generate(data))
  end

  def self.generate_filename(metric, format)
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    File.expand_path("../analytics_#{metric}_#{timestamp}.#{format}", __dir__)
  end
end

# Display handlers
class DisplayFormatter
  def self.print_header(metric, start_date, end_date)
    puts "\n" + "Analytics Export".cyan.bold
    puts "─" * 60
    puts "Metric:      #{metric}"
    puts "Date Range:  #{start_date} to #{end_date}"
    puts
  end

  def self.print_summary(summary)
    puts "\nEngagement Summary".cyan.bold
    puts "─" * 60
    puts "New users:       #{summary[:new_users]}"
    puts "New artworks:    #{summary[:new_artworks]}"
    puts "New galleries:   #{summary[:new_galleries]}"
    puts "New collections: #{summary[:new_collections]}"

    if summary[:total_users]
      puts "\nCumulative:"
      puts "Total users:     #{summary[:total_users]}"
      puts "Total artworks:  #{summary[:total_artworks]}"
    end
    puts
  end

  def self.print_success(filename)
    puts "✓ Export completed successfully".green
    puts "Output:      #{filename}".cyan
    puts
  end

  def self.error(message)
    puts "✗ Error: #{message}".red
  end
end

# Main application
class AnalyticsApp
  def initialize(config)
    @config = config
    @db = if @config.remote
            D1RemoteDatabase.new('site-db')
          else
            AnalyticsDatabase.new(@config.db_path)
          end
  end

  def run
    DisplayFormatter.print_header(@config.metric, @config.start_date, @config.end_date)

    case @config.metric
    when 'signups'
      export_signups
    when 'uploads'
      export_uploads
    when 'categories'
      export_categories
    when 'all'
      export_all
    else
      DisplayFormatter.error "Unknown metric: #{@config.metric}"
      exit(1)
    end
  rescue StandardError => e
    DisplayFormatter.error e.message
    puts e.backtrace if ENV['DEBUG']
    exit(1)
  ensure
    @db.close
  end

  private

  def export_signups
    puts "Fetching signup data...".cyan

    signups = @db.signups_by_date(@config.start_date, @config.end_date)
    summary = @db.engagement_summary(@config.start_date, @config.end_date)

    DisplayFormatter.print_summary(summary)

    output_file = @config.output_file || OutputWriter.generate_filename('signups', @config.output_format)

    if @config.output_format == 'csv'
      OutputWriter.write_csv(
        output_file,
        signups,
        ['signup_date', 'signup_count']
      )
    else
      data = {
        metric: 'signups',
        period: { start: @config.start_date, end: @config.end_date },
        summary: summary,
        daily_data: signups
      }
      OutputWriter.write_json(output_file, data)
    end

    DisplayFormatter.print_success(output_file)
  end

  def export_uploads
    puts "Fetching upload data...".cyan

    uploads = @db.uploads_by_date(@config.start_date, @config.end_date)
    top_artists = @db.uploads_by_artist(@config.start_date, @config.end_date, 10)
    summary = @db.engagement_summary(@config.start_date, @config.end_date)

    DisplayFormatter.print_summary(summary)

    output_file = @config.output_file || OutputWriter.generate_filename('uploads', @config.output_format)

    if @config.output_format == 'csv'
      OutputWriter.write_csv(
        output_file,
        uploads,
        ['upload_date', 'upload_count', 'unique_uploaders', 'avg_title_length']
      )
    else
      data = {
        metric: 'uploads',
        period: { start: @config.start_date, end: @config.end_date },
        summary: summary,
        daily_uploads: uploads,
        top_artists: top_artists
      }
      OutputWriter.write_json(output_file, data)
    end

    DisplayFormatter.print_success(output_file)
  end

  def export_categories
    puts "Fetching category data...".cyan

    categories = @db.popular_categories(@config.start_date, @config.end_date)
    summary = @db.engagement_summary(@config.start_date, @config.end_date)

    DisplayFormatter.print_summary(summary)

    output_file = @config.output_file || OutputWriter.generate_filename('categories', @config.output_format)

    if @config.output_format == 'csv'
      OutputWriter.write_csv(
        output_file,
        categories,
        ['category', 'artwork_count', 'artist_count', 'percentage']
      )
    else
      data = {
        metric: 'categories',
        period: { start: @config.start_date, end: @config.end_date },
        summary: summary,
        categories: categories
      }
      OutputWriter.write_json(output_file, data)
    end

    DisplayFormatter.print_success(output_file)
  end

  def export_all
    puts "Fetching all analytics...".cyan

    signups = @db.signups_by_date(@config.start_date, @config.end_date)
    uploads = @db.uploads_by_date(@config.start_date, @config.end_date)
    categories = @db.popular_categories(@config.start_date, @config.end_date)
    summary = @db.engagement_summary(@config.start_date, @config.end_date)

    DisplayFormatter.print_summary(summary)

    output_file = @config.output_file || OutputWriter.generate_filename('all', @config.output_format)

    if @config.output_format == 'csv'
      # For CSV, create three separate files
      base_name = output_file.sub(/\.[^.]+$/, '')

      OutputWriter.write_csv("#{base_name}_signups.csv", signups, ['signup_date', 'signup_count'])
      OutputWriter.write_csv("#{base_name}_uploads.csv", uploads, ['upload_date', 'upload_count', 'unique_uploaders'])
      OutputWriter.write_csv("#{base_name}_categories.csv", categories, ['category', 'artwork_count', 'artist_count', 'percentage'])

      puts "Generated:"
      puts "  - #{base_name}_signups.csv".cyan
      puts "  - #{base_name}_uploads.csv".cyan
      puts "  - #{base_name}_categories.csv".cyan
    else
      data = {
        period: { start: @config.start_date, end: @config.end_date },
        summary: summary,
        signups: signups,
        uploads: uploads,
        categories: categories
      }
      OutputWriter.write_json(output_file, data)
    end

    DisplayFormatter.print_success(output_file)
  end
end

# Entry point
if __FILE__ == $0
  begin
    config = Config.new
    app = AnalyticsApp.new(config)
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

### Step 2: Make Script Executable

```bash
chmod +x /site/scripts/analytics.rb
```

### Step 3: Add Documentation

Update `/site/docs/ADMIN-SCRIPTS.md`:

```markdown
## Analytics Export Script

Export analytics data for business intelligence and reporting.

### Installation

Already completed with other scripts.

### Usage

#### Export user signups (last 30 days)
```bash
ruby scripts/analytics.rb signups
```

#### Export uploads (custom date range, as CSV)
```bash
ruby scripts/analytics.rb uploads --start 2024-01-01 --end 2024-01-31 --format csv
```

#### Export popular categories
```bash
ruby scripts/analytics.rb categories --format json
```

#### Export all metrics
```bash
ruby scripts/analytics.rb all --format csv
```

#### Use production database
```bash
ruby scripts/analytics.rb signups --remote
```

### Metrics

#### Signups
- Daily user registrations
- Cumulative user count
- Excludes deleted accounts

#### Uploads
- Daily artwork uploads
- Unique uploaders per day
- Average title length
- Top uploading artists

#### Categories
- Artwork count per theme
- Artist count per category
- Percentage of total uploads

### Output Formats

#### JSON (default)
Structured data with summary statistics and detailed records:
```json
{
  "metric": "signups",
  "period": { "start": "2024-01-01", "end": "2024-01-31" },
  "summary": {
    "new_users": 150,
    "new_artworks": 1200
  },
  "daily_data": [
    { "signup_date": "2024-01-01", "signup_count": 5 }
  ]
}
```

#### CSV
Tabular data for spreadsheet analysis:
```
signup_date,signup_count
2024-01-01,5
2024-01-02,8
```

### Examples

```bash
# Last 7 days as JSON
ruby scripts/analytics.rb uploads --start $(date -v-7d +%Y-%m-%d) --end $(date +%Y-%m-%d)

# Full year 2023 as CSV
ruby scripts/analytics.rb all --start 2023-01-01 --end 2023-12-31 --format csv

# Production data, custom output file
ruby scripts/analytics.rb signups --remote --output /tmp/prod_signups.json
```

### Date Range Defaults

- Start: 30 days ago
- End: Today

Override with `--start` and `--end` flags (YYYY-MM-DD format).

### Performance Notes

- For large date ranges, JSON export is faster
- CSV export is better for spreadsheet tools
- Remote queries may take longer depending on network
```

---

## Files to Create/Modify

**Created:**
- `/site/scripts/analytics.rb` - Analytics export script (executable)

**Modified:**
- `/site/docs/ADMIN-SCRIPTS.md` - Add analytics documentation

---

## Verification Checklist

- [ ] `ruby scripts/analytics.rb --help` shows usage and available metrics
- [ ] `ruby scripts/analytics.rb signups` exports signup data as JSON
- [ ] `ruby scripts/analytics.rb uploads --format csv` exports as CSV
- [ ] `ruby scripts/analytics.rb categories` shows popular themes
- [ ] `ruby scripts/analytics.rb all` exports all metrics
- [ ] Date range filtering works correctly (--start and --end flags)
- [ ] JSON output is valid and properly formatted
- [ ] CSV output has correct headers and formatting
- [ ] Summary statistics are calculated correctly
- [ ] Output file naming is consistent with timestamp
- [ ] Custom output file path works (--output flag)
- [ ] Remote D1 queries work (--remote flag)
- [ ] Color output displays correctly
- [ ] Script handles date parsing errors
- [ ] Script handles database errors gracefully

Once verified, proceed to **170-SCRIPT-ORPHAN-CLEANUP.md**.
