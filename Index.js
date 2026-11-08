const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(express.json());

// --- MONGODB CONNECTION CACHING FOR VERCEL ---
let cached = global.mongoose;
if (!cached) { cached = global.mongoose = { conn: null, promise: null }; }

async function connectDB() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        const opts = { bufferCommands: false };
        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then(m => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}

// --- MONGOOSE SCHEMAS ---
const applicationSchema = new mongoose.Schema({
    applicationId: { type: String, required: true, unique: true },
    student: {
        firstName: String, lastName: String,
        dob: Date, gender: String, prevSchool: String
    },
    parent: {
        fatherName: String, motherName: String,
        phone: String, email: String
    },
    address: {
        street: String, city: String,
        state: String, pinCode: String
    },
    academic: { applyingClass: String, specialReq: String },
    status: { 
        type: String, 
        enum: ['Pending', 'Under Review', 'Approved', 'Rejected'], 
        default: 'Pending' 
    },
    remarks: { type: String, default: '' }
}, { timestamps: true });

const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);

// --- API ENDPOINTS ---
app.get('/api/health', (req, res) => res.status(200).json({ status: 'OK' }));

app.post('/api/admissions', async (req, res) => {
    try {
        await connectDB();
        const data = req.body;
        
        // Generate Application ID (e.g., APP-2026-X8B9)
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const year = new Date().getFullYear();
        const applicationId = 'APP-' + year + '-' + randomStr;

        const newApp = new Application({
            applicationId,
            student: data.student,
            parent: data.parent,
            address: data.address,
            academic: data.academic
        });

        await newApp.save();
        res.status(201).json({ success: true, applicationId, message: 'Application submitted successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to submit application. Please try again.' });
    }
});

app.post('/api/admissions/status', async (req, res) => {
    try {
        await connectDB();
        const { applicationId, dob } = req.body;
        const appRecord = await Application.findOne({ applicationId });
        
        if (!appRecord) return res.status(404).json({ success: false, error: 'Application not found.' });
        
        // Verify DOB for security
        const recordDob = new Date(appRecord.student.dob).toISOString().split('T')[0];
        if (recordDob !== dob) return res.status(401).json({ success: false, error: 'Verification failed. Incorrect Date of Birth.' });

        res.status(200).json({ success: true, data: { status: appRecord.status, remarks: appRecord.remarks, class: appRecord.academic.applyingClass } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

// --- FRONTEND GENERATION ---
const PUBLIC_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evergreen International Academy | Premium Education</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg: #f4f7fe;
            --primary: #8e94f2;
            --primary-hover: #7b80e6;
            --secondary: #90dbf4;
            --accent1: #fbc4ab;
            --accent2: #b5e48c;
            --text-dark: #2b2d42;
            --text-light: #8d99ae;
            --white: rgba(255, 255, 255, 0.85);
            
            /* Claymorphism */
            --clay-bg: rgba(255, 255, 255, 0.7);
            --clay-shadow: 10px 10px 20px rgba(209, 217, 230, 0.8), -10px -10px 20px rgba(255, 255, 255, 1);
            --clay-inner: inset 4px 4px 8px rgba(255, 255, 255, 0.9), inset -4px -4px 8px rgba(0, 0, 0, 0.05);
            --clay-btn-inner: inset 2px 2px 4px rgba(255,255,255,0.4), inset -2px -2px 4px rgba(0,0,0,0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        body { background: var(--bg); color: var(--text-dark); overflow-x: hidden; scroll-behavior: smooth; }

        /* Background Shapes */
        .bg-shapes { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1; overflow: hidden; pointer-events: none; }
        .shape { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.6; animation: float 10s infinite ease-in-out alternate; }
        .shape-1 { width: 400px; height: 400px; background: var(--primary); top: -100px; left: -100px; }
        .shape-2 { width: 500px; height: 500px; background: var(--secondary); bottom: -150px; right: -100px; animation-delay: -3s; }
        .shape-3 { width: 300px; height: 300px; background: var(--accent1); top: 40%; left: 30%; animation-delay: -6s; }

        @keyframes float { 0% { transform: translate(0, 0) rotate(0deg); } 100% { transform: translate(30px, 50px) rotate(20deg); } }

        /* Typography & Globals */
        h1, h2, h3 { color: var(--text-dark); margin-bottom: 15px; }
        p { color: var(--text-light); line-height: 1.7; margin-bottom: 15px; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .section-title { text-align: center; margin-bottom: 50px; }
        .section-title h2 { font-size: 2.5rem; color: var(--primary); }
        section { padding: 80px 0; }

        /* Utilities */
        .clay-card {
            background: var(--clay-bg); border-radius: 30px; box-shadow: var(--clay-shadow);
            backdrop-filter: blur(15px); padding: 30px; border: 2px solid rgba(255,255,255,0.5);
            transition: transform 0.3s ease;
        }
        .clay-card:hover { transform: translateY(-5px); }
        
        .clay-btn {
            background: var(--primary); color: white; border: none; padding: 14px 30px;
            border-radius: 50px; font-weight: 600; font-size: 1rem; cursor: pointer;
            box-shadow: 6px 6px 12px rgba(142, 148, 242, 0.4), var(--clay-btn-inner);
            transition: all 0.3s ease; text-decoration: none; display: inline-block;
        }
        .clay-btn:hover { transform: scale(1.05); background: var(--primary-hover); }
        .clay-btn.secondary { background: var(--secondary); box-shadow: 6px 6px 12px rgba(144, 219, 244, 0.4), var(--clay-btn-inner); color: var(--text-dark); }
        
        /* Navigation */
        nav { position: fixed; top: 0; width: 100%; z-index: 1000; padding: 15px 0; transition: all 0.3s; }
        nav.scrolled { background: rgba(255,255,255,0.8); backdrop-filter: blur(20px); box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .nav-container { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .logo { font-size: 1.5rem; font-weight: 800; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 10px; }
        .logo i { background: var(--primary); color: white; padding: 10px; border-radius: 12px; box-shadow: var(--clay-btn-inner); }
        .nav-links { display: flex; gap: 25px; align-items: center; }
        .nav-links a { text-decoration: none; color: var(--text-dark); font-weight: 500; transition: color 0.3s; }
        .nav-links a:hover { color: var(--primary); }

        /* Hero Section */
        .hero { min-height: 100vh; display: flex; align-items: center; padding-top: 80px; }
        .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; align-items: center; }
        .hero-text h1 { font-size: 3.5rem; line-height: 1.2; margin-bottom: 20px; }
        .hero-text h1 span { color: var(--primary); }
        .hero-badge { display: inline-block; background: var(--accent2); color: var(--text-dark); padding: 8px 20px; border-radius: 50px; font-weight: 600; margin-bottom: 20px; box-shadow: var(--clay-btn-inner); }
        .hero-img { position: relative; width: 100%; height: 500px; }
        .hero-img-inner { width: 100%; height: 100%; background: url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80') center/cover; border-radius: 40px; box-shadow: var(--clay-shadow); border: 4px solid white; }

        /* Features */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; }
        .feature-card { text-align: center; }
        .feature-icon { width: 70px; height: 70px; background: var(--clay-bg); border-radius: 20px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--primary); box-shadow: var(--clay-inner); }

        /* Academics */
        .academics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px; }
        .academic-card { padding: 40px 30px; position: relative; overflow: hidden; }
        .academic-card::before { content: ''; position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; border-radius: 50%; opacity: 0.1; background: var(--primary); }

        /* Admission Form Area */
        .admission-section { position: relative; }
        .form-container { max-width: 800px; margin: 0 auto; }
        .form-progress { display: flex; justify-content: space-between; margin-bottom: 40px; position: relative; }
        .form-progress::before { content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 4px; background: #d1d9e6; z-index: 1; transform: translateY(-50%); border-radius: 2px; }
        .step { width: 40px; height: 40px; background: #e0e5ec; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; z-index: 2; box-shadow: var(--clay-shadow); border: 2px solid white; transition: 0.3s; color: var(--text-light); }
        .step.active { background: var(--primary); color: white; box-shadow: var(--clay-btn-inner); }
        
        .form-step { display: none; animation: fadeIn 0.5s; }
        .form-step.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark); }
        .input-group input, .input-group select, .input-group textarea {
            width: 100%; padding: 15px; border-radius: 15px; border: none;
            background: #e6ecf5; box-shadow: inset 4px 4px 8px #c5cddb, inset -4px -4px 8px #ffffff;
            font-size: 1rem; color: var(--text-dark); outline: none; transition: 0.3s;
        }
        .input-group input:focus, .input-group select:focus { background: white; box-shadow: var(--clay-shadow); }
        
        .form-actions { display: flex; justify-content: space-between; margin-top: 30px; }

        /* Status Checker */
        .status-box { background: var(--clay-bg); padding: 30px; border-radius: 20px; box-shadow: var(--clay-shadow); margin-top: 50px; text-align: center; }
        .status-result { margin-top: 20px; padding: 20px; border-radius: 15px; display: none; font-weight: 600; }
        .status-Approved { background: var(--accent2); color: #2d6a4f; }
        .status-Pending { background: #ffe3a3; color: #9c6615; }
        .status-Under { background: var(--secondary); color: #023e8a; }
        .status-Rejected { background: #ffb3c1; color: #a4133c; }

        /* Footer */
        footer { padding: 60px 0 20px; background: rgba(255,255,255,0.5); backdrop-filter: blur(10px); margin-top: 50px; }
        .footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; margin-bottom: 40px; }
        .footer-bottom { text-align: center; padding-top: 20px; border-top: 1px solid rgba(0,0,0,0.1); color: var(--text-light); }
        .social-icons a { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: var(--clay-bg); border-radius: 50%; margin-right: 10px; color: var(--primary); text-decoration: none; box-shadow: var(--clay-shadow); transition: 0.3s; }
        .social-icons a:hover { transform: translateY(-3px); color: white; background: var(--primary); }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .hero-grid { grid-template-columns: 1fr; text-align: center; }
            .hero-text h1 { font-size: 2.5rem; }
            .nav-links { display: none; } /* Add hamburger logic for full build */
            .form-actions { flex-direction: column; gap: 15px; }
            .clay-btn { width: 100%; }
        }

        /* Notifications */
        #toast { position: fixed; bottom: 30px; right: 30px; background: white; padding: 20px 30px; border-radius: 20px; box-shadow: var(--clay-shadow); transform: translateY(100px); opacity: 0; transition: 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55); z-index: 9999; border-left: 5px solid var(--primary); }
        #toast.show { transform: translateY(0); opacity: 1; }
    </style>
</head>
<body>
    <div class="bg-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
    </div>

    <nav id="navbar">
        <div class="nav-container">
            <a href="#" class="logo"><i class="fas fa-graduation-cap"></i> Evergreen</a>
            <div class="nav-links">
                <a href="#home">Home</a>
                <a href="#about">About</a>
                <a href="#academics">Academics</a>
                <a href="#facilities">Facilities</a>
                <a href="#admission">Admissions</a>
                <a href="/admin" target="_blank" class="clay-btn" style="padding: 8px 20px; font-size: 0.9rem;">Portal</a>
            </div>
        </div>
    </nav>

    <section id="home" class="hero container">
        <div class="hero-grid">
            <div class="hero-text">
                <div class="hero-badge">Admission Open 2026-2027</div>
                <h1>Give Your Child the <span>Best Start</span> to a Bright Future!</h1>
                <p>Evergreen International Academy provides world-class education with a focus on holistic development, modern infrastructure, and personalized learning approaches.</p>
                <div style="display: flex; gap: 20px; margin-top: 30px; flex-wrap: wrap;">
                    <a href="#admission" class="clay-btn">Apply Now <i class="fas fa-arrow-right" style="margin-left: 8px;"></i></a>
                    <a href="#about" class="clay-btn secondary">Explore Campus</a>
                </div>
            </div>
            <div class="hero-img">
                <div class="hero-img-inner"></div>
            </div>
        </div>
    </section>

    <section id="about" class="container">
        <div class="section-title">
            <h2>Why Choose Evergreen?</h2>
            <p>Our commitment to excellence sets us apart</p>
        </div>
        <div class="features-grid">
            <div class="clay-card feature-card">
                <div class="feature-icon"><i class="fas fa-chalkboard-teacher"></i></div>
                <h3>Expert Faculty</h3>
                <p>Highly qualified and experienced educators dedicated to nurturing young minds.</p>
            </div>
            <div class="clay-card feature-card">
                <div class="feature-icon"><i class="fas fa-laptop-code"></i></div>
                <h3>Smart Classes</h3>
                <p>Digitally equipped classrooms ensuring interactive and engaging learning experiences.</p>
            </div>
            <div class="clay-card feature-card">
                <div class="feature-icon"><i class="fas fa-shield-alt"></i></div>
                <h3>Safe Campus</h3>
                <p>24/7 security with CCTV surveillance providing a safe environment for students.</p>
            </div>
            <div class="clay-card feature-card">
                <div class="feature-icon"><i class="fas fa-running"></i></div>
                <h3>Sports & Arts</h3>
                <p>Extensive facilities for sports, performing arts, and extracurricular development.</p>
            </div>
        </div>
    </section>

    <section id="academics" class="container">
        <div class="section-title">
            <h2>Academic Programs</h2>
            <p>Structured learning phases tailored for every age group</p>
        </div>
        <div class="academics-grid">
            <div class="clay-card academic-card" style="border-top: 5px solid var(--accent1);">
                <h3>Pre-Primary</h3>
                <p>Ages 3-5 Years</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Focuses on foundational skills, cognitive development, and play-way learning methodology.</p>
            </div>
            <div class="clay-card academic-card" style="border-top: 5px solid var(--secondary);">
                <h3>Primary</h3>
                <p>Classes I to V</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Building strong conceptual understanding in languages, mathematics, and environmental sciences.</p>
            </div>
            <div class="clay-card academic-card" style="border-top: 5px solid var(--primary);">
                <h3>Middle & Secondary</h3>
                <p>Classes VI to X</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Comprehensive curriculum preparing students for board examinations and critical thinking.</p>
            </div>
        </div>
    </section>

    <section id="admission" class="container admission-section">
        <div class="section-title">
            <h2>Online Admission Booking</h2>
            <p>Secure your child's seat in a few simple steps</p>
        </div>
        
        <div class="clay-card form-container">
            <div class="form-progress">
                <div class="step active" id="step1-ind">1</div>
                <div class="step" id="step2-ind">2</div>
                <div class="step" id="step3-ind">3</div>
                <div class="step" id="step4-ind">4</div>
            </div>

            <form id="admissionForm">
                <!-- Step 1 -->
                <div class="form-step active" id="step1">
                    <h3>Student Information</h3>
                    <div class="input-group">
                        <label>First Name *</label>
                        <input type="text" id="firstName" required>
                    </div>
                    <div class="input-group">
                        <label>Last Name *</label>
                        <input type="text" id="lastName" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="input-group">
                            <label>Date of Birth *</label>
                            <input type="date" id="dob" required>
                        </div>
                        <div class="input-group">
                            <label>Gender *</label>
                            <select id="gender" required>
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <div></div>
                        <button type="button" class="clay-btn" onclick="nextStep(1)">Next Step <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>

                <!-- Step 2 -->
                <div class="form-step" id="step2">
                    <h3>Parent/Guardian Information</h3>
                    <div class="input-group">
                        <label>Father's Name *</label>
                        <input type="text" id="fatherName" required>
                    </div>
                    <div class="input-group">
                        <label>Mother's Name *</label>
                        <input type="text" id="motherName" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="input-group">
                            <label>Mobile Number *</label>
                            <input type="tel" id="phone" pattern="[0-9]{10}" placeholder="10 digit number" required>
                        </div>
                        <div class="input-group">
                            <label>Email Address *</label>
                            <input type="email" id="email" required>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="clay-btn secondary" onclick="prevStep(2)"><i class="fas fa-arrow-left"></i> Previous</button>
                        <button type="button" class="clay-btn" onclick="nextStep(2)">Next Step <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>

                <!-- Step 3 -->
                <div class="form-step" id="step3">
                    <h3>Address Details</h3>
                    <div class="input-group">
                        <label>Street / House No. *</label>
                        <input type="text" id="street" required>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="input-group">
                            <label>City *</label>
                            <input type="text" id="city" required>
                        </div>
                        <div class="input-group">
                            <label>State *</label>
                            <input type="text" id="state" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>PIN Code *</label>
                        <input type="text" id="pinCode" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="clay-btn secondary" onclick="prevStep(3)"><i class="fas fa-arrow-left"></i> Previous</button>
                        <button type="button" class="clay-btn" onclick="nextStep(3)">Next Step <i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>

                <!-- Step 4 -->
                <div class="form-step" id="step4">
                    <h3>Academic & Final Review</h3>
                    <div class="input-group">
                        <label>Applying for Class *</label>
                        <select id="applyingClass" required>
                            <option value="">Select Class</option>
                            <option value="Nursery">Nursery</option>
                            <option value="LKG">LKG</option>
                            <option value="UKG">UKG</option>
                            <option value="Class 1">Class 1</option>
                            <option value="Class 2">Class 2</option>
                            <option value="Class 3">Class 3</option>
                            <option value="Class 4">Class 4</option>
                            <option value="Class 5">Class 5</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Previous School (if any)</label>
                        <input type="text" id="prevSchool">
                    </div>
                    <div class="input-group">
                        <label>Special Requirements / Medical Notes</label>
                        <textarea id="specialReq" rows="3"></textarea>
                    </div>
                    <div class="input-group" style="display: flex; gap: 10px; align-items: start;">
                        <input type="checkbox" id="declaration" required style="width: 20px; height: 20px; margin-top: 5px;">
                        <label style="font-size: 0.9rem; line-height: 1.4;">I declare that the information provided is correct. I understand that admission is subject to seat availability and verification of documents.</label>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="clay-btn secondary" onclick="prevStep(4)"><i class="fas fa-arrow-left"></i> Previous</button>
                        <button type="submit" class="clay-btn" id="submitBtn">Submit Application <i class="fas fa-check"></i></button>
                    </div>
                </div>
            </form>
        </div>

        <div class="form-container status-box">
            <h3>Check Application Status</h3>
            <p>Already applied? Track your admission progress.</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-top: 20px;">
                <input type="text" id="checkAppId" placeholder="Application ID (e.g. APP-2026-XXXX)" style="padding: 12px 20px; border-radius: 50px; border: none; background: #e6ecf5; box-shadow: inset 3px 3px 6px #c5cddb, inset -3px -3px 6px #fff; outline: none; width: 250px;">
                <input type="date" id="checkDob" title="Date of Birth" style="padding: 12px 20px; border-radius: 50px; border: none; background: #e6ecf5; box-shadow: inset 3px 3px 6px #c5cddb, inset -3px -3px 6px #fff; outline: none; width: 200px;">
                <button onclick="checkStatus()" class="clay-btn secondary">Check Status</button>
            </div>
            <div id="statusResult" class="status-result"></div>
        </div>
    </section>

    <footer class="container">
        <div class="footer-grid">
            <div>
                <a href="#" class="logo" style="margin-bottom: 20px;"><i class="fas fa-graduation-cap"></i> Evergreen</a>
                <p>Nurturing minds, building futures. Premium education with state-of-the-art facilities.</p>
                <div class="social-icons">
                    <a href="#"><i class="fab fa-facebook-f"></i></a>
                    <a href="#"><i class="fab fa-twitter"></i></a>
                    <a href="#"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div>
                <h3 style="margin-bottom: 20px;">Quick Links</h3>
                <ul style="list-style: none;">
                    <li style="margin-bottom: 10px;"><a href="#home" style="color: var(--text-light); text-decoration: none;">Home</a></li>
                    <li style="margin-bottom: 10px;"><a href="#about" style="color: var(--text-light); text-decoration: none;">About Us</a></li>
                    <li style="margin-bottom: 10px;"><a href="#academics" style="color: var(--text-light); text-decoration: none;">Academics</a></li>
                    <li style="margin-bottom: 10px;"><a href="#admission" style="color: var(--text-light); text-decoration: none;">Admissions</a></li>
                </ul>
            </div>
            <div>
                <h3 style="margin-bottom: 20px;">Contact Us</h3>
                <p><i class="fas fa-map-marker-alt" style="color: var(--primary); margin-right: 10px;"></i> 123 Education Boulevard, Jalandhar, India</p>
                <p><i class="fas fa-phone" style="color: var(--primary); margin-right: 10px;"></i> +91 98765 43210</p>
                <p><i class="fas fa-envelope" style="color: var(--primary); margin-right: 10px;"></i> admissions@evergreen.edu</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Evergreen International Academy. All rights reserved.</p>
        </div>
    </footer>

    <div id="toast">Message here</div>

    <script>
        // Navbar Scroll
        window.addEventListener('scroll', () => {
            const nav = document.getElementById('navbar');
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });

        // Toast Notification
        function showToast(msg, isError = false) {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.style.borderLeftColor = isError ? '#ff4d4d' : 'var(--primary)';
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 4000);
        }

        // Form Stepper Logic
        function validateStep(step) {
            const currentStep = document.getElementById('step' + step);
            const inputs = currentStep.querySelectorAll('input[required], select[required]');
            for(let i=0; i<inputs.length; i++) {
                if(!inputs[i].value) {
                    inputs[i].focus();
                    showToast('Please fill all required fields.', true);
                    return false;
                }
                if(inputs[i].type === 'email' && !inputs[i].value.includes('@')) {
                    showToast('Enter a valid email.', true); return false;
                }
            }
            return true;
        }

        function nextStep(current) {
            if(!validateStep(current)) return;
            document.getElementById('step' + current).classList.remove('active');
            document.getElementById('step' + (current + 1)).classList.add('active');
            document.getElementById('step' + (current + 1) + '-ind').classList.add('active');
        }

        function prevStep(current) {
            document.getElementById('step' + current).classList.remove('active');
            document.getElementById('step' + (current - 1)).classList.add('active');
            document.getElementById('step' + current + '-ind').classList.remove('active');
        }

        // Form Submit
        document.getElementById('admissionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!document.getElementById('declaration').checked) {
                showToast('Please accept the declaration.', true); return;
            }

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.innerHTML = 'Submitting...';
            submitBtn.disabled = true;

            const payload = {
                student: {
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    dob: document.getElementById('dob').value,
                    gender: document.getElementById('gender').value,
                    prevSchool: document.getElementById('prevSchool').value
                },
                parent: {
                    fatherName: document.getElementById('fatherName').value,
                    motherName: document.getElementById('motherName').value,
                    phone: document.getElementById('phone').value,
                    email: document.getElementById('email').value
                },
                address: {
                    street: document.getElementById('street').value,
                    city: document.getElementById('city').value,
                    state: document.getElementById('state').value,
                    pinCode: document.getElementById('pinCode').value
                },
                academic: {
                    applyingClass: document.getElementById('applyingClass').value,
                    specialReq: document.getElementById('specialReq').value
                }
            };

            try {
                const res = await fetch('/api/admissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.success) {
                    document.querySelector('.form-container').innerHTML = 
                        '<div style="text-align:center; padding: 40px;">' +
                        '<i class="fas fa-check-circle" style="font-size: 60px; color: var(--accent2); margin-bottom: 20px;"></i>' +
                        '<h2>Application Submitted!</h2>' +
                        '<p>Your Application ID is: <strong style="color:var(--primary); font-size:1.2rem;">' + data.applicationId + '</strong></p>' +
                        '<p>Please save this ID to check your status later.</p></div>';
                    showToast('Success!');
                } else {
                    showToast(data.error, true);
                    submitBtn.innerHTML = 'Submit Application <i class="fas fa-check"></i>';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                showToast('Network error. Try again.', true);
                submitBtn.innerHTML = 'Submit Application <i class="fas fa-check"></i>';
                submitBtn.disabled = false;
            }
        });

        // Status Check
        async function checkStatus() {
            const appId = document.getElementById('checkAppId').value;
            const dob = document.getElementById('checkDob').value;
            const resDiv = document.getElementById('statusResult');

            if(!appId || !dob) { showToast('Enter App ID and DOB', true); return; }

            resDiv.style.display = 'none';
            resDiv.className = 'status-result';

            try {
                const res = await fetch('/api/admissions/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationId: appId, dob })
                });
                const data = await res.json();

                if (data.success) {
                    resDiv.style.display = 'block';
                    let statusClass = 'status-Pending';
                    if(data.data.status === 'Approved') statusClass = 'status-Approved';
                    else if(data.data.status === 'Rejected') statusClass = 'status-Rejected';
                    else if(data.data.status === 'Under Review') statusClass = 'status-Under';
                    
                    resDiv.classList.add(statusClass);
                    resDiv.innerHTML = 'Status: ' + data.data.status + '<br><span style="font-size:0.9rem; font-weight:400;">Class: ' + data.data.class + '</span>' + 
                                     (data.data.remarks ? '<br><span style="font-size:0.8rem;">Remarks: ' + data.data.remarks + '</span>' : '');
                } else {
                    showToast(data.error, true);
                }
            } catch (err) {
                showToast('Network error.', true);
            }
        }
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(PUBLIC_HTML));

// --- SERVER INSTANCE ---
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Public App running on port ${PORT}`));
}

module.exports = app;
