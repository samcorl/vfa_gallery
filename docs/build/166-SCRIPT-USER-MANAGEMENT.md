# 166-SCRIPT-USER-MANAGEMENT.md
## User Listing and Search Ruby Script

**Goal:** Create a Ruby command-line script for admin tasks to list all users, search by username/email, and display user details with formatted table output.

---

## Spec Extract

From **01-TECHNICAL-SPEC.md**:
- **Database:** CloudFlare D1 (SQLite-compatible)
- **User Data:** Email (admin-visible), username (public), status tracking
- **Authentication:** JWT-based sessions, user creation via Google SSO

---

## Prerequisites

**Must Complete First:**
- 04-D1-DATABASE-INIT.md ✓
- 06-SCHEMA-USERS.md ✓
- 13-SCHEMA-SUPPORTING.md ✓ (sessions table for context)

**Local Requirements:**
- Ruby 3.0+ installed
- `gems` installed: `sqlite3`, `optparse`, `tty-table`, `colorize`
- Wrangler D1 access (for production remote queries)

---

## Steps

### Step 1: Install Ruby Gems

Create or update a `Gemfile` at `/site/Gemfile`:

```ruby
source 'https://rubygems.org'

gem 'sqlite3', '~> 1.6'
gem 'tty-table', '~> 0.12'
gem 'colorize', '~> 0.8'
gem 'optparse', '~> 0.1'
```

Run:

```bash
cd /site
bundle install
```

This installs:
- `sqlite3` - Database access
- `tty-table` - Pretty terminal tables
- `colorize` - Colored console output
- `optparse` - Command-line argument parsing (included in Ruby stdlib, but explicit for clarity)

### Step 2: Create Scripts Directory

```bash
mkdir -p /site/scripts
```

### Step 3: Create User Management Script

Create `/site/scripts/users.rb`:

```ruby
#!/usr/bin/env ruby

require 'sqlite3'
require 'optparse'
require 'tty-table'
require 'colorize'
require 'json'

# Configuration
class Config
  attr_reader :db_path, :command, :search_term, :user_id, :limit, :offset

  def initialize
    @db_path = ENV['D1_DB_PATH'] || File.expand_path('../.wrangler/state/d1/db/site-db.sqlite3', __dir__)
    @command = 'list'
    @search_term = nil
    @user_id = nil
    @limit = 50
    @offset = 0

    parse_options
  end

  private

  def parse_options
    parser = OptionParser.new do |opts|
      opts.banner = "Usage: ruby scripts/users.rb [COMMAND] [OPTIONS]"

      opts.on('list', 'List all users (paginated)') do
        @command = 'list'
      end

      opts.on('search', 'Search users by username or email') do
        @command = 'search'
      end

      opts.on('show', 'Show detailed user info by ID') do
        @command = 'show'
      end

      opts.on('-t', '--term TERM', 'Search term (for search command)') do |term|
        @search_term = term
      end

      opts.on('-i', '--id ID', Integer, 'User ID (for show command)') do |id|
        @user_id = id
      end

      opts.on('-l', '--limit LIMIT', Integer, 'Results limit (default 50)') do |limit|
        @limit = limit
      end

      opts.on('-o', '--offset OFFSET', Integer, 'Results offset for pagination (default 0)') do |offset|
        @offset = offset
      end

      opts.on('-h', '--help', 'Show this help message') do
        puts opts
        exit(0)
      end
    end

    parser.parse!

    # Validate required arguments
    if @command == 'search' && @search_term.nil?
      puts "Error: --term required for search command".red
      exit(1)
    end

    if @command == 'show' && @user_id.nil?
      puts "Error: --id required for show command".red
      exit(1)
    end
  end
end

# Database handler
class UserDatabase
  def initialize(db_path)
    @db = SQLite3::Database.new db_path
    @db.results_as_hash = true
    @db.type_translation = true
  end

  def list_users(limit, offset)
    query = <<~SQL
      SELECT
        id,
        username,
        email,
        slug,
        status,
        created_at,
        last_login_at,
        bio,
        avatar_r2_key
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    SQL

    @db.execute(query, [limit, offset])
  end

  def search_users(term, limit, offset)
    # Search by username or email (case-insensitive)
    search_pattern = "%#{term}%"
    query = <<~SQL
      SELECT
        id,
        username,
        email,
        slug,
        status,
        created_at,
        last_login_at,
        bio,
        avatar_r2_key
      FROM users
      WHERE username LIKE ? OR email LIKE ?
      ORDER BY username ASC
      LIMIT ? OFFSET ?
    SQL

    @db.execute(query, [search_pattern, search_pattern, limit, offset])
  end

  def get_user(user_id)
    query = <<~SQL
      SELECT
        id,
        username,
        email,
        slug,
        status,
        bio,
        avatar_r2_key,
        socials,
        created_at,
        updated_at,
        last_login_at,
        upload_count,
        gallery_count,
        collection_count
      FROM users
      WHERE id = ?
    SQL

    result = @db.execute(query, [user_id])
    result.first if result.any?
  end

  def get_user_stats(user_id)
    # Get related entity counts
    stats = {}

    artworks = @db.execute(
      "SELECT COUNT(*) as count FROM artworks WHERE user_id = ? AND deleted_at IS NULL",
      [user_id]
    ).first
    stats['artworks'] = artworks['count']

    galleries = @db.execute(
      "SELECT COUNT(*) as count FROM galleries WHERE user_id = ? AND deleted_at IS NULL",
      [user_id]
    ).first
    stats['galleries'] = galleries['count']

    collections = @db.execute(
      "SELECT COUNT(*) as count FROM collections WHERE user_id = ? AND deleted_at IS NULL",
      [user_id]
    ).first
    stats['collections'] = collections['count']

    messages_sent = @db.execute(
      "SELECT COUNT(*) as count FROM messages WHERE sender_id = ?",
      [user_id]
    ).first
    stats['messages_sent'] = messages_sent['count']

    messages_received = @db.execute(
      "SELECT COUNT(*) as count FROM messages WHERE recipient_id = ?",
      [user_id]
    ).first
    stats['messages_received'] = messages_received['count']

    stats
  end

  def close
    @db.close
  end
end

# Display handlers
class DisplayFormatter
  def self.list_table(users)
    if users.empty?
      puts "No users found.".yellow
      return
    end

    rows = users.map do |user|
      [
        user['id'].to_s,
        user['username'],
        user['email'],
        user['status'],
        user['created_at'],
        user['last_login_at'] || 'Never'
      ]
    end

    table = TTY::Table.new(
      header: ['ID', 'Username', 'Email', 'Status', 'Created', 'Last Login'],
      rows: rows
    )

    puts table.render(:unicode)
  end

  def self.search_results(users, term)
    if users.empty?
      puts "No users matching '#{term}' found.".yellow
      return
    end

    puts "Found #{users.length} user(s) matching '#{term}':".cyan
    puts

    rows = users.map do |user|
      [
        user['id'].to_s,
        user['username'],
        user['email'],
        user['status'],
        user['created_at']
      ]
    end

    table = TTY::Table.new(
      header: ['ID', 'Username', 'Email', 'Status', 'Created'],
      rows: rows
    )

    puts table.render(:unicode)
  end

  def self.user_detail(user, stats)
    puts "\n" + "User Details".cyan.bold
    puts "─" * 50

    puts "ID:                #{user['id']}"
    puts "Username:          #{user['username']}"
    puts "Slug:              #{user['slug']}"
    puts "Email:             #{user['email']}"
    puts "Status:            #{user['status'].yellow}"
    puts "Bio:               #{user['bio'] || '(none)'.gray}"
    puts "Avatar:            #{user['avatar_r2_key'] || '(none)'.gray}"

    if user['socials']
      puts "Socials:           #{user['socials']}"
    end

    puts "\nTimestamps"
    puts "─" * 50
    puts "Created:           #{user['created_at']}"
    puts "Updated:           #{user['updated_at']}"
    puts "Last Login:        #{user['last_login_at'] || 'Never'.gray}"

    puts "\nActivity Stats"
    puts "─" * 50
    puts "Artworks:          #{stats['artworks']}"
    puts "Galleries:         #{stats['galleries']}"
    puts "Collections:       #{stats['collections']}"
    puts "Messages Sent:     #{stats['messages_sent']}"
    puts "Messages Received: #{stats['messages_received']}"

    puts "\n"
  end

  def self.error(message)
    puts "Error: #{message}".red
  end

  def self.success(message)
    puts message.green
  end
end

# Main application
class UsersApp
  def initialize(config)
    @config = config
    @db = UserDatabase.new(@config.db_path)
  end

  def run
    case @config.command
    when 'list'
      run_list
    when 'search'
      run_search
    when 'show'
      run_show
    else
      DisplayFormatter.error "Unknown command: #{@config.command}"
      exit(1)
    end
  end

  private

  def run_list
    puts "Listing users (limit: #{@config.limit}, offset: #{@config.offset})".cyan
    users = @db.list_users(@config.limit, @config.offset)
    DisplayFormatter.list_table(users)

    if users.length == @config.limit
      puts "\nMore users available. Use --offset #{@config.offset + @config.limit} to see next page.".gray
    end
  rescue StandardError => e
    DisplayFormatter.error "Failed to list users: #{e.message}"
    exit(1)
  ensure
    @db.close
  end

  def run_search
    puts "Searching for users matching '#{@config.search_term}'...".cyan
    users = @db.search_users(@config.search_term, @config.limit, @config.offset)
    DisplayFormatter.search_results(users, @config.search_term)
  rescue StandardError => e
    DisplayFormatter.error "Search failed: #{e.message}"
    exit(1)
  ensure
    @db.close
  end

  def run_show
    user = @db.get_user(@config.user_id)

    unless user
      DisplayFormatter.error "User with ID #{@config.user_id} not found"
      exit(1)
    end

    stats = @db.get_user_stats(@config.user_id)
    DisplayFormatter.user_detail(user, stats)
  rescue StandardError => e
    DisplayFormatter.error "Failed to retrieve user: #{e.message}"
    exit(1)
  ensure
    @db.close
  end
end

# Entry point
if __FILE__ == $0
  begin
    config = Config.new
    app = UsersApp.new(config)
    app.run
  rescue Interrupt
    puts "\nInterrupted.".yellow
    exit(0)
  rescue StandardError => e
    puts "Fatal error: #{e.message}".red
    puts e.backtrace if ENV['DEBUG']
    exit(1)
  end
end
```

### Step 4: Make Script Executable

```bash
chmod +x /site/scripts/users.rb
```

### Step 5: Create Integration with Wrangler D1 (for production)

Create a helper script `/site/scripts/lib/d1_helper.rb`:

```ruby
# Helper for accessing CloudFlare D1 via wrangler CLI
class D1Helper
  def self.execute_query(database_name, query, remote: false)
    env_flag = remote ? '--remote' : '--local'
    cmd = "npx wrangler d1 execute #{database_name} \"#{query}\" #{env_flag}"

    output = `#{cmd}`

    unless $?.success?
      raise "D1 query failed: #{output}"
    end

    # Parse JSON output from wrangler (depends on wrangler version)
    JSON.parse(output)
  rescue JSON::ParserError
    # Fall back to raw output if not JSON
    output
  end
end
```

Then update `/site/scripts/users.rb` to support production mode:

Add this to the `Config` class:

```ruby
@remote = false

# In parse_options, add:
opts.on('-r', '--remote', 'Use remote D1 database (production)') do
  @remote = true
end

attr_reader :remote
```

Update the `UsersApp` initialization to detect mode:

```ruby
def initialize(config)
  @config = config

  if @config.remote
    require_relative 'lib/d1_helper'
    @db = D1RemoteDatabase.new('site-db')
  else
    @db = UserDatabase.new(@config.db_path)
  end
end
```

Create `D1RemoteDatabase` class in the same file:

```ruby
# Remote D1 access via wrangler
class D1RemoteDatabase
  def initialize(database_name)
    @database_name = database_name
    require_relative 'lib/d1_helper'
  end

  def list_users(limit, offset)
    query = "SELECT id, username, email, slug, status, created_at, last_login_at, bio, avatar_r2_key FROM users ORDER BY created_at DESC LIMIT #{limit} OFFSET #{offset};"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def search_users(term, limit, offset)
    escaped_term = term.gsub("'", "''")
    query = "SELECT id, username, email, slug, status, created_at, last_login_at, bio, avatar_r2_key FROM users WHERE username LIKE '%#{escaped_term}%' OR email LIKE '%#{escaped_term}%' ORDER BY username ASC LIMIT #{limit} OFFSET #{offset};"
    D1Helper.execute_query(@database_name, query, remote: true)
  end

  def get_user(user_id)
    query = "SELECT id, username, email, slug, status, bio, avatar_r2_key, socials, created_at, updated_at, last_login_at, upload_count, gallery_count, collection_count FROM users WHERE id = #{user_id};"
    result = D1Helper.execute_query(@database_name, query, remote: true)
    Array(result).first
  end

  def get_user_stats(user_id)
    stats = {}

    artworks_q = "SELECT COUNT(*) as count FROM artworks WHERE user_id = #{user_id} AND deleted_at IS NULL;"
    stats['artworks'] = D1Helper.execute_query(@database_name, artworks_q, remote: true).first['count']

    galleries_q = "SELECT COUNT(*) as count FROM galleries WHERE user_id = #{user_id} AND deleted_at IS NULL;"
    stats['galleries'] = D1Helper.execute_query(@database_name, galleries_q, remote: true).first['count']

    collections_q = "SELECT COUNT(*) as count FROM collections WHERE user_id = #{user_id} AND deleted_at IS NULL;"
    stats['collections'] = D1Helper.execute_query(@database_name, collections_q, remote: true).first['count']

    messages_sent_q = "SELECT COUNT(*) as count FROM messages WHERE sender_id = #{user_id};"
    stats['messages_sent'] = D1Helper.execute_query(@database_name, messages_sent_q, remote: true).first['count']

    messages_received_q = "SELECT COUNT(*) as count FROM messages WHERE recipient_id = #{user_id};"
    stats['messages_received'] = D1Helper.execute_query(@database_name, messages_received_q, remote: true).first['count']

    stats
  end

  def close
    # No persistent connection to close
  end
end
```

### Step 6: Create Usage Documentation

Create `/site/docs/ADMIN-SCRIPTS.md`:

```markdown
# Admin Scripts Guide

## User Management Script

List, search, and view user details.

### Installation

```bash
cd /site
bundle install
chmod +x scripts/users.rb
```

### Usage

#### List all users (first 50)
```bash
ruby scripts/users.rb list
```

#### List with custom limit and offset (pagination)
```bash
ruby scripts/users.rb list --limit 100 --offset 50
```

#### Search users by username or email
```bash
ruby scripts/users.rb search --term "john"
ruby scripts/users.rb search --term "@example.com"
```

#### Show detailed info for a user
```bash
ruby scripts/users.rb show --id 42
```

#### Use production D1 database (requires wrangler auth)
```bash
ruby scripts/users.rb list --remote
ruby scripts/users.rb search --term "test" --remote
ruby scripts/users.rb show --id 42 --remote
```

### Environment Variables

- `D1_DB_PATH` - Path to local SQLite database (default: `.wrangler/state/d1/db/site-db.sqlite3`)
- `DEBUG` - Set to `1` to show full stack traces on errors

### Examples

```bash
# Find all users created today
ruby scripts/users.rb search --term "" --limit 1000

# Check user #42 details including activity
ruby scripts/users.rb show --id 42

# List next 50 users
ruby scripts/users.rb list --limit 50 --offset 50
```
```

---

## Files to Create/Modify

**Created:**
- `/site/scripts/users.rb` - User management script (executable)
- `/site/scripts/lib/d1_helper.rb` - D1 wrangler helper
- `/site/Gemfile` - Ruby dependencies
- `/site/docs/ADMIN-SCRIPTS.md` - Admin scripts documentation

---

## Verification Checklist

- [ ] `bundle install` completes successfully
- [ ] `ruby scripts/users.rb --help` shows usage information
- [ ] `ruby scripts/users.rb list` displays users in formatted table
- [ ] `ruby scripts/users.rb search --term "test"` returns matching users
- [ ] `ruby scripts/users.rb show --id 1` displays user details with stats
- [ ] Script handles 0 results gracefully with helpful message
- [ ] Script handles database errors with clear error messages
- [ ] Color output displays correctly (green success, red errors, cyan headers)
- [ ] Table formatting displays correctly with unicode borders
- [ ] Pagination message shows when more results available
- [ ] `ruby scripts/users.rb list --remote` works with production D1
- [ ] Script exits cleanly on Ctrl+C

Once verified, proceed to **167-SCRIPT-BULK-STATUS.md**.
