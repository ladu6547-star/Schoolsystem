const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());

// --- MONGODB CONNECTION CACHING ---
let cached = global.mongoose;
if (!cached) { cached = global.mongoose = { conn: null, promise: null }; }

async function connectDB() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false }).then(m => m);
    }
    cached.conn = await cached.promise;
    await seedAdmin();
    return cached.conn;
}

// --- MODELS ---
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

// Need Application model to manage records
const applicationSchema = new mongoose.Schema({
    applicationId: String, student: Object, parent: Object, address: Object, academic: Object, status: String, remarks: String
}, { timestamps: true, strict: false });
const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);

// --- SEED ADMIN FROM ENV ---
async function seedAdmin() {
    try {
        const count = await Admin.countDocuments();
        if (count === 0 && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
            await Admin.create({ username: process.env.ADMIN_USERNAME, password: hashedPassword });
            console.log('Admin account created from environment variables.');
        }
    } catch (err) { console.error('Seeding error:', err); }
}

// --- AUTHENTICATION MIDDLEWARE ---
const requireAuth = (req, res, next) => {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// --- ADMIN API ENDPOINTS ---
app.post('/api/admin/login', async (req, res) => {
    await connectDB();
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
        
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

app.get('/api/admin/me', requireAuth, (req, res) => res.json({ loggedIn: true, user: req.admin.username }));

app.get('/api/admin/stats', requireAuth, async (req, res) => {
    await connectDB();
    const total = await Application.countDocuments();
    const pending = await Application.countDocuments({ status: 'Pending' });
    const approved = await Application.countDocuments({ status: 'Approved' });
    const rejected = await Application.countDocuments({ status: 'Rejected' });
    res.json({ total, pending, approved, rejected });
});

app.get('/api/admin/applications', requireAuth, async (req, res) => {
    await connectDB();
    const apps = await Application.find().sort({ createdAt: -1 });
    res.json(apps);
});

app.patch('/api/admin/applications/:id/status', requireAuth, async (req, res) => {
    await connectDB();
    const { status, remarks } = req.body;
    await Application.findByIdAndUpdate(req.params.id, { status, remarks: remarks || '' });
    res.json({ success: true });
});

app.delete('/api/admin/applications/:id', requireAuth, async (req, res) => {
    await connectDB();
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// --- ADMIN FRONTEND ---
const ADMIN_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | School Admission System</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg: #f0f4f8; --primary: #8e94f2; --text-dark: #2b2d42; --text-light: #8d99ae;
            --clay-bg: rgba(255, 255, 255, 0.8);
            --clay-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff;
            --clay-inner: inset 4px 4px 8px rgba(255, 255, 255, 0.9), inset -4px -4px 8px rgba(0, 0, 0, 0.05);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        body { background: var(--bg); color: var(--text-dark); display: flex; min-height: 100vh; }
        
        /* Utility */
        .clay-card { background: var(--clay-bg); border-radius: 20px; box-shadow: var(--clay-shadow); padding: 25px; border: 1px solid white; }
        .btn { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; transition: 0.3s; box-shadow: 3px 3px 6px rgba(142, 148, 242, 0.4); }
        .btn:hover { transform: translateY(-2px); }
        .btn-danger { background: #ff4d4d; box-shadow: 3px 3px 6px rgba(255, 77, 77, 0.4); }
        .btn-danger:hover { background: #ff3333; }
        
        input, select { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #e6ecf5; box-shadow: inset 3px 3px 6px #c5cddb, inset -3px -3px 6px #fff; outline: none; margin-bottom: 15px; }

        /* Login Screen */
        #loginScreen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: var(--bg); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .login-box { width: 400px; text-align: center; }

        /* Dashboard Layout */
        #dashboardScreen { display: none; width: 100%; padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { text-align: center; }
        .stat-card h3 { font-size: 2rem; color: var(--primary); }
        .stat-card p { font-size: 0.9rem; color: var(--text-light); }

        /* Table */
        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
        th, td { padding: 15px; text-align: left; }
        th { color: var(--text-light); font-weight: 500; font-size: 0.9rem; }
        tr.data-row { background: var(--clay-bg); box-shadow: var(--clay-shadow); border-radius: 15px; }
        tr.data-row td:first-child { border-top-left-radius: 15px; border-bottom-left-radius: 15px; }
        tr.data-row td:last-child { border-top-right-radius: 15px; border-bottom-right-radius: 15px; }
        
        .status-badge { padding: 5px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 600; }
        .badge-Pending { background: #ffe3a3; color: #9c6615; }
        .badge-Under { background: #90dbf4; color: #023e8a; }
        .badge-Approved { background: #b5e48c; color: #2d6a4f; }
        .badge-Rejected { background: #ffb3c1; color: #a4133c; }

        .action-select { width: 130px; padding: 8px; margin: 0; font-size: 0.85rem; }
    </style>
</head>
<body>
    
    <!-- Login Screen -->
    <div id="loginScreen">
        <div class="clay-card login-box">
            <h2 style="margin-bottom: 20px; color: var(--primary);"><i class="fas fa-lock"></i> Admin Access</h2>
            <form id="loginForm">
                <input type="text" id="username" placeholder="Admin Username" required>
                <input type="password" id="password" placeholder="Password" required>
                <button type="submit" class="btn" style="width: 100%;">Secure Login</button>
            </form>
            <p id="loginError" style="color: red; margin-top: 10px; font-size: 0.9rem; display: none;">Invalid credentials</p>
        </div>
    </div>

    <!-- Dashboard Screen -->
    <div id="dashboardScreen">
        <div class="header">
            <h2><i class="fas fa-chart-pie"></i> Admission Dashboard</h2>
            <div>
                <span id="adminName" style="margin-right: 20px; font-weight: 500;"></span>
                <button class="btn btn-danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
        </div>

        <div class="stats-grid">
            <div class="clay-card stat-card"><h3 id="statTotal">-</h3><p>Total Applications</p></div>
            <div class="clay-card stat-card"><h3 id="statPending">-</h3><p>Pending Review</p></div>
            <div class="clay-card stat-card"><h3 id="statApproved">-</h3><p>Approved</p></div>
            <div class="clay-card stat-card"><h3 id="statRejected">-</h3><p>Rejected</p></div>
        </div>

        <div class="clay-card table-responsive">
            <h3 style="margin-bottom: 20px;">Recent Applications</h3>
            <table>
                <thead>
                    <tr>
                        <th>APP ID</th>
                        <th>Student Name</th>
                        <th>Class</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="appTableBody">
                    <!-- Data loaded via JS -->
                </tbody>
            </table>
        </div>
    </div>

    <script>
        // Check Auth Status on Load
        async function checkAuth() {
            try {
                const res = await fetch('/api/admin/me');
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('loginScreen').style.display = 'none';
                    document.getElementById('dashboardScreen').style.display = 'block';
                    document.getElementById('adminName').innerText = 'Welcome, ' + data.user;
                    loadDashboardData();
                }
            } catch (err) {}
        }

        // Login Submit
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            if (res.ok) { window.location.reload(); }
            else { document.getElementById('loginError').style.display = 'block'; }
        });

        // Logout
        async function logout() {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.reload();
        }

        // Load Data
        async function loadDashboardData() {
            const statRes = await fetch('/api/admin/stats');
            const stats = await statRes.json();
            document.getElementById('statTotal').innerText = stats.total;
            document.getElementById('statPending').innerText = stats.pending;
            document.getElementById('statApproved').innerText = stats.approved;
            document.getElementById('statRejected').innerText = stats.rejected;

            const appRes = await fetch('/api/admin/applications');
            const apps = await appRes.json();
            const tbody = document.getElementById('appTableBody');
            tbody.innerHTML = '';
            
            apps.forEach(app => {
                const date = new Date(app.createdAt).toLocaleDateString();
                const badgeClass = 'badge-' + (app.status === 'Under Review' ? 'Under' : app.status);
                
                const tr = document.createElement('tr');
                tr.className = 'data-row';
                tr.innerHTML = \`
                    <td><strong>\${app.applicationId}</strong></td>
                    <td>\${app.student.firstName} \${app.student.lastName}<br><span style="font-size:0.8rem; color:var(--text-light);">\${app.parent.phone}</span></td>
                    <td>\${app.academic.applyingClass}</td>
                    <td>\${date}</td>
                    <td><span class="status-badge \${badgeClass}">\${app.status}</span></td>
                    <td>
                        <select class="action-select" onchange="updateStatus('\${app._id}', this.value)">
                            <option value="">Change Status...</option>
                            <option value="Pending">Pending</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                        <button class="btn btn-danger" style="padding: 6px 12px; margin-left: 5px;" onclick="deleteApp('\${app._id}')"><i class="fas fa-trash"></i></button>
                    </td>
                \`;
                tbody.appendChild(tr);
            });
        }

        async function updateStatus(id, newStatus) {
            if(!newStatus) return;
            const remarks = prompt("Add remarks for status change (optional):", "");
            await fetch('/api/admin/applications/' + id + '/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, remarks })
            });
            loadDashboardData();
        }

        async function deleteApp(id) {
            if(confirm('Are you sure you want to delete this application permanently?')) {
                await fetch('/api/admin/applications/' + id, { method: 'DELETE' });
                loadDashboardData();
            }
        }

        checkAuth();
    </script>
</body>
</html>
`;

app.get('/admin', (req, res) => res.send(ADMIN_HTML));

// --- SERVER INSTANCE ---
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`Admin App running on port ${PORT}`));
}

module.exports = app;
