#!/usr/bin/env ruby

require 'optparse'
require 'colorize'
require 'tty-table'
require_relative 'lib/db_helper'

class UsersManager
  def initialize(remote: false)
    @remote = remote
    @db = remote ? nil : DbHelper.local_connection
  end

  def list(limit: 20, offset: 0)
    sql = "SELECT id, email, username, display_name, status, role, created_at FROM users LIMIT ? OFFSET ?"
    results = execute_query(sql, [limit, offset])

    if results.empty?
      puts "No users found.".yellow
      return
    end

    rows = results.map do |row|
      [
        row['id'][0..7],
        row['email'],
        row['username'],
        row['display_name'] || '-',
        colorize_status(row['status']),
        row['role'],
        row['created_at'][0..10]
      ]
    end

    table = TTY::Table.new(
      header: ['ID', 'Email', 'Username', 'Display Name', 'Status', 'Role', 'Created'],
      rows: rows
    )

    puts table.render(:ascii)
    puts "\nShowing #{results.length} users (offset: #{offset}, limit: #{limit})"
  end

  def search(query, limit: 20, offset: 0)
    search_term = "%#{query}%"
    sql = "SELECT id, email, username, display_name, status, role, created_at FROM users WHERE email LIKE ? OR username LIKE ? OR display_name LIKE ? LIMIT ? OFFSET ?"
    results = execute_query(sql, [search_term, search_term, search_term, limit, offset])

    if results.empty?
      puts "No users found matching: #{query}".yellow
      return
    end

    rows = results.map do |row|
      [
        row['id'][0..7],
        row['email'],
        row['username'],
        row['display_name'] || '-',
        colorize_status(row['status']),
        row['role'],
        row['created_at'][0..10]
      ]
    end

    table = TTY::Table.new(
      header: ['ID', 'Email', 'Username', 'Display Name', 'Status', 'Role', 'Created'],
      rows: rows
    )

    puts table.render(:ascii)
    puts "\nFound #{results.length} users matching '#{query}'"
  end

  def show(user_id)
    sql = "SELECT * FROM users WHERE id = ?"
    results = execute_query(sql, [user_id])

    if results.empty?
      puts "User not found: #{user_id}".red
      return
    end

    user = results.first

    # Get counts
    artworks_count = get_count("SELECT COUNT(*) as count FROM artworks WHERE user_id = ? AND status != 'deleted'", [user_id])
    galleries_count = get_count("SELECT COUNT(*) as count FROM galleries WHERE user_id = ?", [user_id])
    collections_count = get_count("SELECT COUNT(*) as count FROM collections c JOIN galleries g ON c.gallery_id = g.id WHERE g.user_id = ?", [user_id])
    messages_sent = get_count("SELECT COUNT(*) as count FROM messages WHERE sender_id = ?", [user_id])
    messages_received = get_count("SELECT COUNT(*) as count FROM messages WHERE recipient_id = ?", [user_id])

    puts "\n" + "=== User Details ===".cyan
    puts "ID:                  #{user['id']}"
    puts "Email:               #{user['email']}"
    puts "Username:            #{user['username']}"
    puts "Display Name:        #{user['display_name'] || '(not set)'}"
    puts "Status:              #{colorize_status(user['status'])}"
    puts "Role:                #{user['role']}"
    puts "Bio:                 #{user['bio'] || '(not set)'}"
    puts "Website:             #{user['website'] || '(not set)'}"
    puts "Phone:               #{user['phone'] || '(not set)'}"
    puts "Avatar URL:          #{user['avatar_url'] || '(not set)'}"
    puts "\n" + "=== Limits ===".cyan
    puts "Gallery Limit:       #{user['gallery_limit']}"
    puts "Collection Limit:    #{user['collection_limit']}"
    puts "Artwork Limit:       #{user['artwork_limit']}"
    puts "Daily Upload Limit:  #{user['daily_upload_limit']}"
    puts "\n" + "=== Activity ===".cyan
    puts "Email Verified At:   #{user['email_verified_at'] || '(not verified)'}"
    puts "Created At:          #{user['created_at']}"
    puts "Updated At:          #{user['updated_at']}"
    puts "Last Login At:       #{user['last_login_at'] || '(never)'}"
    puts "\n" + "=== Counts ===".cyan
    puts "Artworks:            #{artworks_count}"
    puts "Galleries:           #{galleries_count}"
    puts "Collections:         #{collections_count}"
    puts "Messages Sent:       #{messages_sent}"
    puts "Messages Received:   #{messages_received}"
    puts "\n"
  end

  private

  def execute_query(sql, params = [])
    if @remote
      # For remote queries, we need a different approach
      # This is simplified - in production you'd handle param substitution differently
      D1RemoteHelper.execute_query(sql)
    else
      @db.execute(sql, params)
    end
  end

  def get_count(sql, params = [])
    results = execute_query(sql, params)
    results.empty? ? 0 : results.first['count']
  end

  def colorize_status(status)
    case status
    when 'active'
      status.green
    when 'suspended'
      status.red
    when 'pending'
      status.yellow
    else
      status
    end
  end
end

def main
  options = {
    command: 'list',
    remote: false,
    limit: 20,
    offset: 0,
    id: nil,
    query: nil
  }

  OptionParser.new do |opts|
    opts.banner = "Usage: users.rb [OPTIONS]"

    opts.on('--list', 'List users (default)') { options[:command] = 'list' }
    opts.on('--show ID', 'Show user details') { |id| options[:command] = 'show'; options[:id] = id }
    opts.on('--search QUERY', 'Search users') { |q| options[:command] = 'search'; options[:query] = q }
    opts.on('--limit N', Integer, 'Limit results (default: 20)') { |n| options[:limit] = n }
    opts.on('--offset N', Integer, 'Offset results (default: 0)') { |n| options[:offset] = n }
    opts.on('--remote', 'Use remote D1 database') { options[:remote] = true }
    opts.on('-h', '--help', 'Show this message') do
      puts opts
      exit
    end
  end.parse!

  begin
    manager = UsersManager.new(remote: options[:remote])

    case options[:command]
    when 'list'
      manager.list(limit: options[:limit], offset: options[:offset])
    when 'show'
      if options[:id].nil?
        puts "Error: --show requires an ID".red
        exit 1
      end
      manager.show(options[:id])
    when 'search'
      if options[:query].nil?
        puts "Error: --search requires a query".red
        exit 1
      end
      manager.search(options[:query], limit: options[:limit], offset: options[:offset])
    end
  rescue => e
    puts "Error: #{e.message}".red
    exit 1
  end
end

main if __FILE__ == $0
