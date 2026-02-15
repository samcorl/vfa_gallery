#!/usr/bin/env ruby

require 'json'
require 'csv'
require 'date'
require 'optparse'
require 'colorize'
require_relative 'lib/db_helper'

class AnalyticsExport
  DEFAULT_DAYS = 30
  OUTPUT_DIR = File.join(DbHelper.project_root, 'scripts', 'samples')

  def initialize(options = {})
    @command = options[:command] || 'all'
    @start_date = options[:start_date] || (Date.today - DEFAULT_DAYS)
    @end_date = options[:end_date] || Date.today
    @format = options[:format] || 'json'
    @output_file = options[:output_file]
    @remote = options[:remote] || false
    @verbose = options[:verbose] || false

    validate_dates
    FileUtils.mkdir_p(OUTPUT_DIR) unless Dir.exist?(OUTPUT_DIR)
  end

  def run
    puts "Exporting #{@command} analytics...".cyan
    puts "Date range: #{@start_date} to #{@end_date}".yellow if @verbose
    puts "Using #{@remote ? 'REMOTE' : 'LOCAL'} database".yellow

    case @command
    when 'signups'
      export_signups
    when 'uploads'
      export_uploads
    when 'categories'
      export_categories
    when 'all'
      export_all
    else
      raise "Unknown command: #{@command}"
    end
  rescue StandardError => e
    puts "\n✗ Analytics export failed: #{e.message}".red
    puts e.backtrace.join("\n") if @verbose
    exit 1
  end

  private

  def validate_dates
    raise "Invalid date format for --start" unless @start_date.is_a?(Date)
    raise "Invalid date format for --end" unless @end_date.is_a?(Date)
    raise "Start date must be before end date" if @start_date > @end_date
  end

  def export_signups
    puts "\nFetching signups data...".cyan

    sql = %{
      SELECT DATE(created_at) as signup_date, COUNT(*) as signup_count
      FROM users
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY signup_date ASC
    }

    results = execute_query(sql)

    puts "✓ Found #{results.length} days with signups".green

    output_file = @output_file || generate_filename('signups')
    write_output(output_file, results)
  end

  def export_uploads
    puts "\nFetching uploads data...".cyan

    sql = %{
      SELECT DATE(created_at) as upload_date, COUNT(*) as upload_count, COUNT(DISTINCT user_id) as unique_uploaders
      FROM artworks
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY upload_date ASC
    }

    results = execute_query(sql)

    puts "✓ Found #{results.length} days with uploads".green

    output_file = @output_file || generate_filename('uploads')
    write_output(output_file, results)
  end

  def export_categories
    puts "\nFetching category data...".cyan

    sql = %{
      SELECT category, COUNT(*) as artwork_count, COUNT(DISTINCT user_id) as artist_count
      FROM artworks
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted' AND category IS NOT NULL
      GROUP BY category
      ORDER BY artwork_count DESC
      LIMIT 20
    }

    results = execute_query(sql)

    puts "✓ Found #{results.length} categories".green

    output_file = @output_file || generate_filename('categories')
    write_output(output_file, results)
  end

  def export_all
    puts "\nGenerating comprehensive analytics report...".cyan

    report = {
      'report_date' => Time.now.iso8601,
      'date_range' => {
        'start' => @start_date.to_s,
        'end' => @end_date.to_s
      },
      'source' => @remote ? 'remote' : 'local',
      'summary' => fetch_engagement_summary,
      'signups' => fetch_signups_data,
      'uploads' => fetch_uploads_data,
      'categories' => fetch_categories_data,
      'top_artists' => fetch_top_artists
    }

    output_file = @output_file || generate_filename('analytics_report')
    write_output(output_file, report)
  end

  def fetch_engagement_summary
    puts "  Fetching engagement summary...".cyan

    summary = {}

    # Total signups
    sql = %{
      SELECT COUNT(*) as count FROM users
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
    }
    result = execute_query(sql)
    summary['signups'] = result.first&.dig('count') || 0

    # Total uploads
    sql = %{
      SELECT COUNT(*) as count FROM artworks
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
    }
    result = execute_query(sql)
    summary['uploads'] = result.first&.dig('count') || 0

    # Total galleries
    sql = %{
      SELECT COUNT(*) as count FROM galleries
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}'
    }
    result = execute_query(sql)
    summary['galleries'] = result.first&.dig('count') || 0

    # Total collections
    sql = %{
      SELECT COUNT(*) as count FROM collections
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}'
    }
    result = execute_query(sql)
    summary['collections'] = result.first&.dig('count') || 0

    summary
  end

  def fetch_signups_data
    puts "  Fetching signups...".cyan

    sql = %{
      SELECT DATE(created_at) as signup_date, COUNT(*) as signup_count
      FROM users
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY signup_date ASC
    }

    execute_query(sql)
  end

  def fetch_uploads_data
    puts "  Fetching uploads...".cyan

    sql = %{
      SELECT DATE(created_at) as upload_date, COUNT(*) as upload_count, COUNT(DISTINCT user_id) as unique_uploaders
      FROM artworks
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted'
      GROUP BY DATE(created_at)
      ORDER BY upload_date ASC
    }

    execute_query(sql)
  end

  def fetch_categories_data
    puts "  Fetching categories...".cyan

    sql = %{
      SELECT category, COUNT(*) as artwork_count, COUNT(DISTINCT user_id) as artist_count
      FROM artworks
      WHERE DATE(created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND status != 'deleted' AND category IS NOT NULL
      GROUP BY category
      ORDER BY artwork_count DESC
      LIMIT 20
    }

    execute_query(sql)
  end

  def fetch_top_artists
    puts "  Fetching top artists...".cyan

    sql = %{
      SELECT u.username, COUNT(*) as upload_count
      FROM artworks a
      JOIN users u ON a.user_id = u.id
      WHERE DATE(a.created_at) BETWEEN '#{@start_date}' AND '#{@end_date}' AND a.status != 'deleted'
      GROUP BY a.user_id, u.username
      ORDER BY upload_count DESC
      LIMIT 20
    }

    execute_query(sql)
  end

  def execute_query(sql)
    if @remote
      D1RemoteHelper.execute_query(sql)
    else
      execute_local_query(sql)
    end
  rescue StandardError => e
    puts "✗ Query failed: #{e.message}".red
    raise
  end

  def execute_local_query(sql)
    db = DbHelper.local_connection
    db.execute(sql).map { |row| row.is_a?(Hash) ? row : convert_row_to_hash(row) }
  ensure
    db.close if db
  end

  def convert_row_to_hash(row)
    return row if row.is_a?(Hash)
    row
  end

  def write_output(output_file, data)
    case @format
    when 'json'
      write_json(output_file, data)
    when 'csv'
      write_csv(output_file, data)
    else
      raise "Unknown format: #{@format}"
    end
  end

  def write_json(file, data)
    File.write(file, JSON.pretty_generate(data))
    size = File.size(file)
    puts "✓ JSON exported to #{File.basename(file)} (#{format_size(size)})".green
  end

  def write_csv(file, data)
    return write_csv_report(file, data) if data.is_a?(Hash)

    data_array = data.is_a?(Array) ? data : [data]

    return if data_array.empty?

    CSV.open(file, 'w') do |csv|
      # Write header
      headers = data_array.first.keys
      csv << headers

      # Write rows
      data_array.each do |row|
        csv << headers.map { |h| row[h] }
      end
    end

    size = File.size(file)
    puts "✓ CSV exported to #{File.basename(file)} (#{format_size(size)})".green
  end

  def write_csv_report(file, report)
    CSV.open(file, 'w') do |csv|
      csv << ['Analytics Report']
      csv << ['Generated', report['report_date']]
      csv << ['Start Date', report['date_range']['start']]
      csv << ['End Date', report['date_range']['end']]
      csv << ['Source', report['source']]
      csv << []

      # Summary section
      csv << ['Summary']
      report['summary'].each do |key, value|
        csv << [key.to_s.humanize, value]
      end
      csv << []

      # Signups section
      if report['signups'].is_a?(Array) && !report['signups'].empty?
        csv << ['Signups']
        csv << report['signups'].first.keys
        report['signups'].each { |row| csv << row.values }
        csv << []
      end

      # Uploads section
      if report['uploads'].is_a?(Array) && !report['uploads'].empty?
        csv << ['Uploads']
        csv << report['uploads'].first.keys
        report['uploads'].each { |row| csv << row.values }
        csv << []
      end

      # Categories section
      if report['categories'].is_a?(Array) && !report['categories'].empty?
        csv << ['Categories']
        csv << report['categories'].first.keys
        report['categories'].each { |row| csv << row.values }
        csv << []
      end

      # Top Artists section
      if report['top_artists'].is_a?(Array) && !report['top_artists'].empty?
        csv << ['Top Artists']
        csv << report['top_artists'].first.keys
        report['top_artists'].each { |row| csv << row.values }
      end
    end

    size = File.size(file)
    puts "✓ CSV report exported to #{File.basename(file)} (#{format_size(size)})".green
  end

  def generate_filename(name)
    timestamp = Time.now.strftime('%Y%m%d_%H%M%S')
    extension = @format == 'json' ? 'json' : 'csv'
    File.join(OUTPUT_DIR, "#{name}_#{timestamp}.#{extension}")
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
  opts.banner = "Usage: analytics.rb <command> [options]"
  opts.separator ""
  opts.separator "Commands:"
  opts.separator "  signups       Export user signups data"
  opts.separator "  uploads       Export artwork uploads data"
  opts.separator "  categories    Export category statistics"
  opts.separator "  all           Generate comprehensive analytics report"
  opts.separator ""
  opts.separator "Options:"

  opts.on('--start DATE', 'Start date (YYYY-MM-DD)') do |date|
    begin
      options[:start_date] = Date.parse(date)
    rescue ArgumentError
      puts "Invalid date format: #{date}. Use YYYY-MM-DD"
      exit 1
    end
  end

  opts.on('--end DATE', 'End date (YYYY-MM-DD)') do |date|
    begin
      options[:end_date] = Date.parse(date)
    rescue ArgumentError
      puts "Invalid date format: #{date}. Use YYYY-MM-DD"
      exit 1
    end
  end

  opts.on('--format FORMAT', 'Output format: json (default) or csv') do |format|
    unless %w[json csv].include?(format)
      puts "Invalid format: #{format}. Use 'json' or 'csv'"
      exit 1
    end
    options[:format] = format
  end

  opts.on('--output FILE', 'Custom output file path') do |file|
    options[:output_file] = file
  end

  opts.on('--remote', 'Use remote production database') { options[:remote] = true }

  opts.on('-v', '--verbose', 'Verbose output') { options[:verbose] = true }

  opts.on('-h', '--help', 'Show this help message') do
    puts opts
    exit
  end
end

begin
  parser.parse!
  options[:command] = ARGV.shift || 'all'
rescue OptionParser::InvalidOption => e
  puts e.message
  puts parser
  exit 1
end

analytics = AnalyticsExport.new(options)
analytics.run
