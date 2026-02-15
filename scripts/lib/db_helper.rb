#!/usr/bin/env ruby

require 'sqlite3'
require 'json'

module DbHelper
  def self.project_root
    File.expand_path('../..', __dir__)
  end

  def self.discover_db_path
    return ENV['D1_DB_PATH'] if ENV['D1_DB_PATH']

    pattern = File.join(project_root, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '*.sqlite')
    files = Dir.glob(pattern)

    raise "No local D1 database found. Run 'npx wrangler d1 execute vfa-gallery-db --local --command \"SELECT 1\"' first." if files.empty?
    raise "Multiple D1 databases found: #{files.join(', ')}. Set D1_DB_PATH to specify." if files.length > 1

    files.first
  end

  def self.local_connection
    db = SQLite3::Database.new(discover_db_path)
    db.results_as_hash = true
    db
  end
end

class D1RemoteHelper
  DATABASE_NAME = 'vfa-gallery-db'

  def self.execute_query(sql)
    cmd = %(npx wrangler d1 execute #{DATABASE_NAME} --command "#{sql.gsub('"', '\\"')}" --remote --json)
    output = `#{cmd}`

    unless $?.success?
      raise "D1 remote query failed: #{output}"
    end

    parsed = JSON.parse(output)
    # Wrangler returns an array of result sets
    if parsed.is_a?(Array) && parsed.first && parsed.first['results']
      parsed.first['results']
    else
      []
    end
  rescue JSON::ParserError
    raise "Failed to parse D1 response: #{output}"
  end
end
