const winston = require("winston");
const path = require("path");
const { LOGS_DIR } = require("./config/logger");

const dateStr = new Date().toISOString().slice(0, 10);
const logFilePath = path.join(LOGS_DIR, `ptero-patcher-${dateStr}.log`);

// Custom console format to show only the message without JSON structure
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message }) => {
        return `${message}`;
    })
);

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: logFilePath })
    ]
});

logger.add(new winston.transports.Console({
    format: consoleFormat
}));

module.exports = logger;
