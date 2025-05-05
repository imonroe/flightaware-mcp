/**
 * Simple logger utility
 */
class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {*} data - Optional data to include
   */
  error(message, data) {
    this._log('error', message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {*} data - Optional data to include
   */
  warn(message, data) {
    this._log('warn', message, data);
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {*} data - Optional data to include
   */
  info(message, data) {
    this._log('info', message, data);
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {*} data - Optional data to include
   */
  debug(message, data) {
    this._log('debug', message, data);
  }

  /**
   * Internal logging method
   * @private
   */
  _log(level, message, data) {
    if (this.levels[level] <= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      const logData = { timestamp, level, message };
      
      if (data !== undefined) {
        if (data instanceof Error) {
          logData.error = {
            message: data.message,
            stack: data.stack,
            code: data.code,
            name: data.name
          };
        } else {
          logData.data = data;
        }
      }
      
      console.log(JSON.stringify(logData));
    }
  }
}

module.exports = new Logger();