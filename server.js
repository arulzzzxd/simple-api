const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const zlib = require('zlib');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Status tracking variables
let totalRequests = 0;
let requestTimes = [];
let statusHistory = [];
let cpuUsageHistory = [];
let memoryUsageHistory = [];
const MAX_HISTORY = 100;

app.set('json spaces', 2);

// Request logger middleware
app.use((req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;
    
    res.end = function(...args) {
        const duration = Date.now() - start;
        totalRequests++;
        requestTimes.push(duration);
        statusHistory.push({
            timestamp: new Date().toISOString(),
            endpoint: req.originalUrl,
            method: req.method,
            duration: duration
        });
        
        if (requestTimes.length > MAX_HISTORY) {
            requestTimes.shift();
        }
        if (statusHistory.length > MAX_HISTORY) {
            statusHistory.shift();
        }
        
        originalEnd.apply(res, args);
    };
    
    next();
});

const manualCompression = (req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const oldSend = res.send;

  res.send = function (body) {
    const contentType = res.getHeader('Content-Type') || '';
    
    if (contentType.match(/image|video|audio|zip|pdf/gi)) {
      return oldSend.call(this, body);
    }

    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      if (acceptEncoding.includes('gzip')) {
        zlib.gzip(body, (err, compressed) => {
          if (!err) {
            res.setHeader('Content-Encoding', 'gzip');
            oldSend.call(this, compressed);
          } else {
            oldSend.call(this, body);
          }
        });
      } else if (acceptEncoding.includes('deflate')) {
        zlib.deflate(body, (err, compressed) => {
          if (!err) {
            res.setHeader('Content-Encoding', 'deflate');
            oldSend.call(this, compressed);
          } else {
            oldSend.call(this, body);
          }
        });
      } else {
        oldSend.call(this, body);
      }
    } else {
      oldSend.call(this, body);
    }
  };
  next();
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { status: false, message: 'Terlalu banyak request, coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(manualCompression);
app.use(limiter);
app.use(morgan('dev'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function registerPlugins() {
  const pluginsDir = path.join(__dirname, 'plugins');
  const apiList = [];
  let registeredCount = 0;

  if (!fs.existsSync(pluginsDir)) {
    console.log('Plugins directory not found, creating...');
    fs.mkdirSync(pluginsDir, { recursive: true });
    return { count: 0, list: [] };
  }

  console.log('Scanning plugins directory:', pluginsDir);

  const categories = fs.readdirSync(pluginsDir)
    .filter(file => {
      const filePath = path.join(pluginsDir, file);
      return fs.statSync(filePath).isDirectory();
    });

  console.log('Found categories:', categories);

  categories.forEach(category => {
    const categoryPath = path.join(pluginsDir, category);
    console.log('Checking category:', categoryPath);

    if (!fs.existsSync(categoryPath)) return;

    const files = fs.readdirSync(categoryPath)
      .filter(f => f.endsWith('.js') || f.endsWith('.ts'));

    console.log('Files in ' + category + ':', files);

    files.forEach(file => {
      const filePath = path.join(categoryPath, file);
      console.log('Loading plugin:', filePath);
      
      try {
        // Clear cache untuk hot reload
        delete require.cache[require.resolve(filePath)];
        
        const plugin = require(filePath);
        
        console.log('Plugin loaded successfully:', plugin.name || 'Unnamed');
        
        // Validasi plugin
        if (!plugin.name || !plugin.desc || !plugin.method || !plugin.path || typeof plugin.run !== 'function') {
          console.warn('Plugin ' + file + ' tidak valid. Required fields: name, desc, method, path, run');
          console.warn('Available fields:', Object.keys(plugin));
          return;
        }

        // Set default category jika tidak ada
        if (!plugin.category) {
          plugin.category = category.charAt(0).toUpperCase() + category.slice(1);
        }

        const method = plugin.method.toLowerCase();
        let fullPath = plugin.path.startsWith('/') ? plugin.path : `/${plugin.path}`;
        
        // Jika path sudah mengandung kategori, jangan duplikasi
        if (!fullPath.includes(`/${category.toLowerCase()}`)) {
          fullPath = `/${category.toLowerCase()}${fullPath}`;
        }

        console.log('Registering: ' + method.toUpperCase() + ' ' + fullPath);

        // Register route
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const routeHandler = async (req, res) => {
            try {
              console.log('Handling ' + method.toUpperCase() + ' ' + fullPath);
              await plugin.run(req, res);
            } catch (err) {
              console.error('Error in plugin ' + plugin.name + ':', err);
              if (!res.headersSent) {
                res.status(500).json({ 
                  status: false, 
                  message: 'Internal Server Error',
                  error: err.message 
                });
              }
            }
          };

          // Apply rate limiting to plugin routes
          app[method](fullPath, routeHandler);

          registeredCount++;

          const apiInfo = {
            nama: plugin.name,
            deskripsi: plugin.desc,
            kategori: plugin.category,
            method: method.toUpperCase(),
            endpoint: fullPath,
            contoh: plugin.example || null
          };

          if (plugin.params && Array.isArray(plugin.params)) {
            apiInfo.parameter = plugin.params.map(param => ({
              nama: param,
              tipe: 'query',
              required: true
            }));
            
            if (method === 'get' && !apiInfo.contoh) {
              const exampleParams = plugin.params.map(p => `${p}=value`).join('&');
              apiInfo.contoh = `${fullPath}?${exampleParams}`;
            }
          }

          apiList.push(apiInfo);
        }
      } catch (err) {
        console.error('Error loading plugin ' + file + ':', err);
      }
    });
  });

  console.log('Total plugins registered:', registeredCount);
  console.log('API List:', apiList.map(a => a.endpoint));

  return { count: registeredCount, list: apiList };
}

const { count, list: apiList } = registerPlugins();

// Get CPU usage
function getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    
    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    
    return {
        idle: totalIdle / cpus.length,
        total: totalTick / cpus.length
    };
}

let cpuUsageStart = getCpuUsage();

// Calculate average latency
function calculateAverageLatency() {
    if (requestTimes.length === 0) return 0;
    const sum = requestTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / requestTimes.length);
}

// Get current CPU percentage
function getCurrentCpuPercentage() {
    const cpuEnd = getCpuUsage();
    const idleDifference = cpuEnd.idle - cpuUsageStart.idle;
    const totalDifference = cpuEnd.total - cpuUsageStart.total;
    const percentage = 100 - (100 * idleDifference / totalDifference);
    cpuUsageStart = cpuEnd;
    return Math.min(100, Math.max(0, percentage.toFixed(1)));
}

// NEW ENDPOINT: Status Page Data
app.get('/api/status', (req, res) => {
    try {
        const avgLatency = calculateAverageLatency();
        const cpuUsage = getCurrentCpuPercentage();
        const memoryUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        // Calculate requests per second (last 10 seconds)
        const tenSecondsAgo = Date.now() - 10000;
        const recentRequests = statusHistory.filter(req => 
            new Date(req.timestamp).getTime() > tenSecondsAgo
        );
        const rps = recentRequests.length / 10;
        
        // Get current time
        const now = new Date();
        const wib = new Date(now.getTime());
        const wita = new Date(now.getTime() + 60 * 60 * 1000);
        const wit = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
        // Update history for charts
        const currentTime = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        cpuUsageHistory.push({
            time: currentTime,
            usage: parseFloat(cpuUsage)
        });
        
        memoryUsageHistory.push({
            time: currentTime,
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(totalMem / 1024 / 1024)
        });
        
        // Keep only last 20 data points
        if (cpuUsageHistory.length > 20) cpuUsageHistory.shift();
        if (memoryUsageHistory.length > 20) memoryUsageHistory.shift();
        
        const response = {
            status: true,
            server: {
                name: "API Server",
                status: "online",
                uptime: process.uptime().toFixed(2),
                started_at: new Date(Date.now() - process.uptime() * 1000).toISOString()
            },
            time: {
                wib: wib.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                wita: wita.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                wit: wit.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                server_time: now.toISOString()
            },
            metrics: {
                total_requests: totalRequests,
                requests_per_second: parseFloat(rps.toFixed(2)),
                avg_latency: avgLatency,
                live_requests: Math.round(rps * 10)
            },
            hardware: {
                cpu: {
                    usage: parseFloat(cpuUsage),
                    cores: os.cpus().length,
                    model: os.cpus()[0]?.model || "Unknown",
                    speed: os.cpus()[0]?.speed || 0
                },
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    total: Math.round(totalMem / 1024 / 1024),
                    free: Math.round(freeMem / 1024 / 1024),
                    percentage: Math.round((memoryUsage.heapUsed / totalMem) * 100)
                },
                os: {
                    platform: os.platform(),
                    release: os.release(),
                    arch: os.arch()
                }
            },
            charts: {
                cpu_history: cpuUsageHistory,
                memory_history: memoryUsageHistory
            }
        };
        
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Status endpoint error:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Failed to get status data',
            error: error.message 
        });
    }
});

// NEW ENDPOINT: Live updates
app.get('/api/status/live', (req, res) => {
    const cpuUsage = getCurrentCpuPercentage();
    const memoryUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const avgLatency = calculateAverageLatency();
    
    const response = {
        timestamp: new Date().toISOString(),
        cpu_usage: parseFloat(cpuUsage),
        memory_used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        memory_total: Math.round(totalMem / 1024 / 1024),
        avg_latency: avgLatency,
        total_requests: totalRequests
    };
    
    res.status(200).json(response);
});

app.get('/api/info', (req, res) => {
  try {
    const response = {
      status: true,
      server: "REST API Premium",
      version: "1.2.0",
      total_endpoints: apiList.length + 2,
      endpoint_categories: [...new Set(apiList.map(api => api.kategori))],
      status_endpoints: [
        { method: 'GET', endpoint: '/api/status', description: 'Get server status data' },
        { method: 'GET', endpoint: '/api/status/live', description: 'Get live metrics' }
      ],
      apis: apiList.sort((a, b) => {
        if (a.kategori !== b.kategori) return a.kategori.localeCompare(b.kategori);
        return a.nama.localeCompare(b.nama);
      })
    };
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

app.get('/api/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  
  res.status(200).json({
    status: true,
    message: 'Server is healthy',
    uptime: process.uptime().toFixed(2),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(totalMem / 1024 / 1024) + ' MB',
      percentage: Math.round((memoryUsage.heapUsed / totalMem) * 100) + '%'
    },
    totalRequests: totalRequests
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Status page route
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

app.use((req, res) => {
  res.status(404).json({ 
    status: false, 
    message: `Endpoint ${req.originalUrl} tidak ditemukan`,
    help: '/api/info'
  });
});

app.use((err, req, res, next) => {
  if (!res.headersSent) {
    res.status(500).json({ 
      status: false, 
      message: 'Critical Server Error',
      error: err.message 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log('SERVER RUNNING ON PORT: ' + PORT);
  console.log('TOTAL PLUGINS: ' + count);
  console.log('Status page available at: http://localhost:' + PORT + '/status');
  console.log('Plugin endpoints:');
  apiList.forEach(api => {
    console.log('  ' + api.method + ' ' + api.endpoint);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
