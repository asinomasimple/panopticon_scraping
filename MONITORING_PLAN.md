# Monitoring & Notification System - Implementation Plan (SIMPLIFIED)

## Overview

Add a **simple, practical health check interface** to monitor scraping status, view recent data, get error notifications, and trigger runs remotely.

## Architecture Decision

**Approach**: Add Express web server to this existing project
- Scraper and web interface run together on Raspberry Pi
- Single codebase for easier deployment
- Not shipping a product - building a practical personal tool
- Easy to separate later if needed, but keeping together avoids API/deployment complexity

## Design Philosophy: Keep It Simple

**What you actually need:**
1. ✅ Is scraping working? (health check)
2. ✅ When did it last run successfully?
3. ✅ What was scraped? (quick verification against website)
4. ✅ Are there errors?
5. ✅ Remote trigger from anywhere

**What you DON'T need:**
- ❌ Historical log database (you already have history in `replies` table!)
- ❌ Complex log management
- ❌ Separate monitoring project (would require APIs, more complexity)

## Simplified Logging Strategy

**No database for logs - just practical status tracking:**

1. **Status File** (`status.json`)
   - Simple JSON file updated after each run
   - Contains: last run time, status (success/error), counts, last error message
   - Fast to read, easy to update, always available

2. **Single Log File** (`logs/latest.log`)
   - For debugging when you need details
   - Overwritten each run
   - Viewable in web interface

3. **Existing Data** (`replies` table)
   - Already has `created_at` and `last_modified_at`
   - Query recent entries for verification
   - This IS your history!

4. **Email Notifications**
   - Send on errors with log content
   - Immediate awareness when something breaks

**Result**: Simple, practical, no over-engineering!

## Tech Stack

- **Web Framework**: Express.js
- **Templating**: EJS (simple, server-side rendering)
- **Remote Access**: Tailscale (already installed on Pi)
- **Email**: Nodemailer + Gmail SMTP
- **Status Storage**: Simple JSON file (`status.json`)
- **Logging**: Single log file (`logs/latest.log`)
- **Authentication**: express-session + bcrypt (password-protected interface)
- **Data Source**: Existing `replies` table (already has timestamps!)

---

## Implementation Plan

### Phase 1: Status Tracking (Simple JSON File)

**1. Create `src/status.js`** - Simple status management:
```javascript
const fs = require('fs').promises;
const path = require('path');

const STATUS_FILE = path.join(__dirname, '../status.json');

async function updateStatus(data) {
  const status = {
    lastRun: new Date().toISOString(),
    status: data.status || 'success',
    topicsScraped: data.topicsScraped || 0,
    repliesScraped: data.repliesScraped || 0,
    error: data.error || null,
    isRunning: data.isRunning || false
  };

  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
  return status;
}

async function getStatus() {
  try {
    const content = await fs.readFile(STATUS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    // Default status if file doesn't exist
    return {
      lastRun: null,
      status: 'unknown',
      topicsScraped: 0,
      repliesScraped: 0,
      error: null,
      isRunning: false
    };
  }
}

async function markRunning() {
  const status = await getStatus();
  status.isRunning = true;
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

async function markComplete() {
  const status = await getStatus();
  status.isRunning = false;
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
}

module.exports = { updateStatus, getStatus, markRunning, markComplete };
```

---

### Phase 2: Logging (Single File)

**2. Install winston for file logging**
```bash
npm install winston
```

**3. Create `src/logger.js`** - Winston configuration (single file):
```javascript
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'latest.log');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    // Console output
    new winston.transports.Console(),

    // Single file (overwritten each run)
    new winston.transports.File({
      filename: logFile,
      options: { flags: 'w' } // 'w' flag overwrites the file
    })
  ]
});

// Helper to read current log file
logger.getLogContent = () => {
  try {
    return fs.readFileSync(logFile, 'utf8');
  } catch (err) {
    return '';
  }
};

module.exports = logger;
```

**4. Modify `index.js`** to update status file:
```javascript
const logger = require('./src/logger');
const { updateStatus, markRunning, markComplete } = require('./src/status');
const { sendErrorNotification } = require('./src/email');

async function start() {
  logger.info('=== Scraping started ===');
  await markRunning();

  try {
    // Existing scraping logic
    const topicsCount = await importTopics();
    logger.info(`Scraped ${topicsCount} topics`);

    const repliesCount = await updateAndScrapeReplies();
    logger.info(`Scraped/updated ${repliesCount} replies`);

    logger.info('=== Scraping completed successfully ===');

    // Update status file
    await updateStatus({
      status: 'success',
      topicsScraped: topicsCount,
      repliesScraped: repliesCount,
      error: null,
      isRunning: false
    });

  } catch (error) {
    logger.error('Scraping failed', { error: error.message, stack: error.stack });

    // Update status file with error
    await updateStatus({
      status: 'error',
      error: error.message,
      isRunning: false
    });

    // Send email notification
    const logContent = logger.getLogContent();
    try {
      await sendErrorNotification(error, logContent);
      logger.info('Error notification email sent');
    } catch (emailError) {
      logger.error('Failed to send error notification', { error: emailError.message });
    }

    throw error; // Re-throw to maintain existing error handling
  }
}
```

**5. Replace all console.log/console.error** throughout the codebase:
- Replace `console.log()` with `logger.info()`
- Replace `console.error()` with `logger.error()`
- This ensures ALL output goes to `latest.log` file

**6. Update scraping functions** to return counts:
- `importTopics()` - Return number of topics scraped
- `updateAndScrapeReplies()` - Return number of replies updated/added

---

### Phase 3: Express Web Server

**7. Install dependencies**
```bash
npm install express ejs nodemailer express-session bcrypt
```

**8. Create `server.js`** with authentication:
```javascript
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const logger = require('./src/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
}

// Routes
app.get('/login', require('./routes/login'));
app.post('/login', require('./routes/login-post'));
app.get('/logout', require('./routes/logout'));

// Protected routes
app.get('/', requireAuth, require('./routes/dashboard'));
app.get('/logs', requireAuth, require('./routes/logs'));
app.get('/api/status', requireAuth, require('./routes/api/status'));
app.get('/api/recent-data', requireAuth, require('./routes/api/recent-data'));
app.post('/api/trigger', requireAuth, require('./routes/api/trigger'));

app.listen(PORT, () => {
  logger.info(`Monitoring server running on http://localhost:${PORT}`);
});
```

**9. Create route files**:
- `routes/login.js` - Login page
- `routes/login-post.js` - Login form handler
- `routes/logout.js` - Logout handler
- `routes/dashboard.js` - Main health check page
- `routes/logs.js` - View `logs/latest.log`
- `routes/api/status.js` - Return status.json contents
- `routes/api/trigger.js` - Manual trigger endpoint
- `routes/api/recent-data.js` - Query recent entries from `replies` table

---

### Phase 4: Web Interface

**10. Create `views/` directory with EJS templates**:

**views/login.ejs**:
- Simple login form
- Username + password fields

**views/dashboard.ejs** (HEALTH CHECK PAGE):
- **Status Card** (from `status.json`):
  - Large status indicator: ✅ Running / ⚠️ Stale / ❌ Error
  - Last successful run time
  - Topics/replies scraped in last run
  - Error message (if any)
  - **"Run Now" button**

- **Recent Data** (from `replies` table):
  - Last 10 created entries (with links to actual website)
  - Last 10 updated entries
  - Quick human verification against source website

- **Quick Stats**:
  - Total topics, total replies in database
  - Updates in last 24 hours

**views/logs.ejs**:
- Display `logs/latest.log` content
- Refresh button
- Download button
- Syntax highlighting for errors

**views/layout.ejs**:
- Simple header/navigation
- Dashboard | Logs | Logout

**11. Create `public/` directory**:
- `public/css/style.css` - Clean, minimal styling
- `public/js/main.js` - Client-side JavaScript (AJAX for trigger button, auto-refresh status)

---

### Phase 5: Email Notifications

**12. Create `src/email.js`** with full log content:
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

async function sendErrorNotification(error, logContent) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: 'Panopticon Scraping Error',
    html: `
      <h2>Scraping Error Detected</h2>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Error:</strong> ${error.message}</p>

      <h3>Complete Log Output:</h3>
      <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto; max-height: 500px;">${logContent || 'Log content not available'}</pre>

      <p><a href="${process.env.MONITORING_URL}/logs">View Logs in Dashboard</a></p>

      <hr>
      <h3>Full Error Stack:</h3>
      <pre style="background: #ffebee; padding: 10px; overflow-x: auto;">${error.stack}</pre>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendErrorNotification };
```

**13. Update `.env` with all settings**:
```env
# Database (existing)
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_DATABASE=panopticon

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
NOTIFICATION_EMAIL=your-email@gmail.com

# Monitoring Configuration
MONITORING_URL=http://your-pi-tailscale-ip:3000
PORT=3000
SESSION_SECRET=generate-random-secret-here

# Login Credentials (will be hashed)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=generate-with-bcrypt
```

**14. Setup Gmail App Password**:
- Go to Google Account → Security → 2-Step Verification → App Passwords
- Generate password for "Mail"
- Add to `.env` file

**15. Generate password hash** for login:
```bash
node -e "console.log(require('bcrypt').hashSync('your-password-here', 10))"
# Copy the output to ADMIN_PASSWORD_HASH in .env
```

---

### Phase 6: Remote Trigger Functionality

**16. Implement `/api/trigger` endpoint**:
```javascript
// routes/api/trigger.js
let isRunning = false;

module.exports = async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Scraping already running' });
  }

  isRunning = true;

  // Run asynchronously
  const { start } = require('../../index');
  start().finally(() => { isRunning = false; });

  res.json({ success: true, message: 'Scraping started' });
};
```

**17. Add client-side trigger handler** in `public/js/main.js`:
```javascript
document.getElementById('trigger-btn').addEventListener('click', async () => {
  const response = await fetch('/api/trigger', { method: 'POST' });
  const data = await response.json();
  alert(data.message || data.error);
});
```

---

### Phase 7: Tailscale Access (Already Set Up!)

**18. Create `src/db_queries.js`** - Query recent data:
```javascript
const pool = require('./db_replies');

async function getRecentEntries(limit = 10) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id, user, topic_title, created, score
       FROM replies
       WHERE status = 200
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    connection.release();
  }
}

async function getRecentUpdates(limit = 10) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id, user, topic_title, created, score, last_modified_at
       FROM replies
       WHERE status = 200 AND last_modified_at IS NOT NULL
       ORDER BY last_modified_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    connection.release();
  }
}

async function getStats() {
  const connection = await pool.getConnection();
  try {
    const [topics] = await connection.execute('SELECT COUNT(*) as count FROM topics');
    const [replies] = await connection.execute('SELECT COUNT(*) as count FROM replies WHERE status = 200');
    const [recent] = await connection.execute(
      'SELECT COUNT(*) as count FROM replies WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );

    return {
      totalTopics: topics[0].count,
      totalReplies: replies[0].count,
      last24Hours: recent[0].count
    };
  } finally {
    connection.release();
  }
}

module.exports = { getRecentEntries, getRecentUpdates, getStats };
```

**19. Access via Tailscale**:
- Your Pi is already on your Tailscale network
- Find your Pi's Tailscale IP: `tailscale ip -4`
- Access monitoring at: `http://<tailscale-ip>:3000`
- Works from any device on your Tailscale network (phone, laptop, etc.)

**20. Optional: Set up Tailscale Funnel** (for public access):
```bash
# Enable HTTPS and public access via Tailscale
tailscale funnel 3000
# Gets a public URL: https://<machine-name>.tailscale-funnel.ts.net
```

**21. Update README.md** with setup instructions and Tailscale access info

---

## File Structure (New Files)

```
panopticon_scraping/
├── index.js (modified - status updates)
├── server.js (new - Express app)
├── status.json (new - auto-generated)
├── package.json (modified)
├── .env (updated)
├── MONITORING_PLAN.md (this file)
├── logs/
│   └── latest.log (overwritten each run)
├── src/
│   ├── logger.js (new - winston)
│   ├── status.js (new - status file management)
│   ├── email.js (new - notifications)
│   ├── db_queries.js (new - query recent data)
│   └── ... (existing files)
├── routes/
│   ├── login.js (new)
│   ├── login-post.js (new)
│   ├── logout.js (new)
│   ├── dashboard.js (new - health check)
│   ├── logs.js (new - view latest.log)
│   └── api/
│       ├── status.js (new - return status.json)
│       ├── trigger.js (new - manual trigger)
│       └── recent-data.js (new - recent entries)
├── views/
│   ├── layout.ejs (new)
│   ├── login.ejs (new)
│   ├── dashboard.ejs (new - main page)
│   └── logs.ejs (new)
└── public/
    ├── css/
    │   └── style.css (new)
    └── js/
        └── main.js (new)
```

---

## Environment Variables to Add

```env
# Database (existing)
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_DATABASE=panopticon

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
NOTIFICATION_EMAIL=your-email@gmail.com

# Monitoring Configuration
MONITORING_URL=http://<tailscale-ip>:3000
PORT=3000
SESSION_SECRET=your-random-secret-here

# Login Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=bcrypt-hashed-password-here
```

---

## Testing Checklist

- [ ] `status.json` created and updated after scraping runs
- [ ] Winston creates `logs/latest.log` and overwrites on each run
- [ ] Successful run: status.json shows success + counts
- [ ] Error run: status.json shows error + message
- [ ] Web server starts on port 3000
- [ ] Login page works with bcrypt authentication
- [ ] Dashboard shows last run status prominently (✅/⚠️/❌)
- [ ] Dashboard displays recent created entries from `replies` table
- [ ] Dashboard displays recent updated entries from `replies` table
- [ ] Quick stats show total counts and 24h activity
- [ ] Logs page displays `latest.log` content
- [ ] "Run Now" button triggers scraping
- [ ] Email sent on error with log content
- [ ] Accessible via Tailscale IP from phone/laptop
- [ ] Cron job continues working as before

---

## Future Enhancements

1. **Real-time updates**: WebSocket for live scraping progress
2. **Charts**: Visualize scraping activity over time
3. **Alerts**: Configurable thresholds (e.g., no updates for 24h → auto-email)
4. **Mobile app**: Simple React Native app for monitoring
5. **Slack/Discord**: Alternative notification channels
6. **Pause/Resume**: Controls to pause cron job temporarily
7. **Log search**: Full-text search across log files
8. **Multiple users**: User management with different access levels

---

## Migration Path to Web Server

When moving to a dedicated web server:

1. **Option A: Keep scraper on Pi, move web UI to cloud**
   - Pi runs only scraping + cron
   - Web server queries same database
   - Trigger endpoint calls Pi API

2. **Option B: Move everything to cloud**
   - Deploy entire app to VPS/cloud
   - Use cloud cron (GCP Cloud Scheduler, AWS EventBridge)
   - Remove Cloudflare Tunnel

3. **Current setup makes both options easy** - no refactoring needed!

---

## Estimated Timeline

- **Phase 1** (Status File): 15-20 minutes
- **Phase 2** (Logging): 20-30 minutes
- **Phase 3** (Express Server + Auth): 30-45 minutes
- **Phase 4** (Web Interface): 45-60 minutes
- **Phase 5** (Email): 15-20 minutes
- **Phase 6** (Remote Trigger): 10-15 minutes
- **Phase 7** (Tailscale): 5 minutes (already done!)

**Total: 2-3 hours** of focused work (simplified from original 3-4 hours!)

## Key Principles

1. **Simplicity**: No database for logs, just practical status tracking
2. **Use existing data**: `replies` table already has your history
3. **Health check focus**: Is it working? When? What was scraped?
4. **Practical verification**: Show recent data to compare with website
5. **Not over-engineered**: Building a tool for yourself, not shipping a product
6. **Same project**: Avoiding API/deployment complexity of separate repos
