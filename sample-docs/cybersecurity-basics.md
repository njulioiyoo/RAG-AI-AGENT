---
title: "Cybersecurity Fundamentals"
author: "Security Team"
category: "Security"
tags: ["cybersecurity", "security", "hacking", "protection"]
difficulty: "intermediate"
last_updated: "2024-01-18"
---

# Cybersecurity Fundamentals

Cybersecurity adalah praktek untuk melindungi systems, networks, dan programs dari digital attacks. Cyber attacks biasanya bertujuan untuk mengakses, mengubah, atau menghancurkan sensitive information, extort money dari users, atau interrupt normal business processes.

## Mengapa Cybersecurity Penting?

Di era digital ini, hampir semua aspek kehidupan bergantung pada teknologi:
- **Personal Data**: Photo, email, financial information
- **Business Operations**: Customer data, intellectual property, financial records
- **Critical Infrastructure**: Power grids, transportation, healthcare systems
- **National Security**: Government data, military information

### Cost of Cyber Attacks
- **Data Breaches**: Average cost $4.24 million per incident
- **Ransomware**: Global damage $20 billion in 2021
- **Business Downtime**: Can cost $5,600 per minute
- **Reputation Damage**: Long-term customer trust loss

## Common Cyber Threats

### 1. Malware
Software yang dirancang untuk merusak atau gain unauthorized access ke systems.

#### Types of Malware:
- **Virus**: Self-replicating code yang attach ke legitimate programs
- **Worms**: Standalone malware yang replicate untuk spread ke other computers
- **Trojans**: Disguise sebagai legitimate software
- **Ransomware**: Encrypt files dan demand payment for decryption
- **Spyware**: Secretly gather information tentang users
- **Rootkits**: Hide existence dari other software

```bash
# Example malware detection
# Check running processes
ps aux | grep -E "(suspicious|unknown)"

# Check network connections
netstat -an | grep ESTABLISHED

# Check startup programs
ls -la /etc/init.d/
```

### 2. Phishing
Attempt untuk steal sensitive information dengan pretending to be trustworthy entity.

#### Common Phishing Techniques:
- **Email Phishing**: Fake emails dari banks, social media
- **Spear Phishing**: Targeted attacks pada specific individuals
- **Whaling**: Target high-profile individuals (CEOs, executives)
- **Smishing**: Phishing via SMS
- **Vishing**: Voice phishing via phone calls

#### Red Flags:
```
❌ Urgent action required
❌ Generic greetings ("Dear customer")
❌ Suspicious links/attachments
❌ Grammar/spelling errors
❌ Requests for sensitive information
```

### 3. Social Engineering
Psychological manipulation untuk trick people into divulging confidential information.

#### Common Tactics:
- **Pretexting**: Create fabricated scenario
- **Baiting**: Offer something enticing
- **Quid Pro Quo**: Promise benefit in exchange for information
- **Tailgating**: Follow authorized person into restricted area

### 4. Man-in-the-Middle (MITM) Attacks
Attacker secretly intercepts communication between two parties.

```
User ←→ Attacker ←→ Website
     (intercepts)
```

#### Protection:
- Use HTTPS websites
- Avoid public Wi-Fi for sensitive activities
- Use VPN
- Verify SSL certificates

### 5. SQL Injection
Attack yang insert malicious SQL code into application queries.

```sql
-- Vulnerable query
SELECT * FROM users WHERE username = '$username' AND password = '$password'

-- Malicious input
username: admin'--
password: anything

-- Resulting query (bypasses password check)
SELECT * FROM users WHERE username = 'admin'-- AND password = 'anything'
```

#### Prevention:
```javascript
// Use parameterized queries
const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
db.query(query, [username, hashedPassword]);

// Input validation
function validateInput(input) {
    // Remove special characters
    return input.replace(/[^a-zA-Z0-9]/g, '');
}
```

## Security Principles

### 1. CIA Triad
Foundation of information security:

- **Confidentiality**: Information accessible only to authorized parties
- **Integrity**: Information tidak berubah tanpa authorization
- **Availability**: Information accessible ketika needed

### 2. Defense in Depth
Multiple layers of security controls:

```
Perimeter Security → Network Security → Host Security → Application Security → Data Security
```

### 3. Principle of Least Privilege
Users hanya diberikan minimum access needed untuk their job.

```bash
# Example: Create user dengan limited permissions
sudo useradd -m -s /bin/bash limiteduser
sudo usermod -aG specificgroup limiteduser

# Grant specific permissions only
sudo chmod 750 /specific/directory
sudo chown root:specificgroup /specific/directory
```

### 4. Zero Trust Model
"Never trust, always verify" - verify every user dan device.

## Security Controls

### 1. Authentication
Verify identity of users atau systems.

#### Multi-Factor Authentication (MFA):
```
Something you know (password)
+ Something you have (phone/token)  
+ Something you are (biometric)
= Strong Authentication
```

#### Implementation Example:
```javascript
const speakeasy = require('speakeasy');

// Generate secret for user
const secret = speakeasy.generateSecret({
    name: 'MyApp',
    account: user.email
});

// Verify TOTP token
function verifyMFA(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1
    });
}
```

### 2. Authorization
Control what authenticated users dapat access.

```javascript
// Role-based access control (RBAC)
const permissions = {
    admin: ['read', 'write', 'delete'],
    user: ['read'],
    guest: []
};

function checkPermission(userRole, action) {
    return permissions[userRole]?.includes(action) || false;
}

// Middleware for Express.js
function requirePermission(action) {
    return (req, res, next) => {
        if (checkPermission(req.user.role, action)) {
            next();
        } else {
            res.status(403).json({error: 'Insufficient permissions'});
        }
    };
}

app.delete('/admin/users/:id', requirePermission('delete'), deleteUser);
```

### 3. Encryption
Protect data in transit dan at rest.

#### Symmetric Encryption:
```javascript
const crypto = require('crypto');

function encrypt(text, password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        encrypted,
        iv: iv.toString('hex')
    };
}
```

#### Asymmetric Encryption (RSA):
```javascript
const crypto = require('crypto');

// Generate key pair
const {publicKey, privateKey} = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
});

// Encrypt with public key
function encryptWithPublicKey(text, publicKey) {
    return crypto.publicEncrypt(publicKey, Buffer.from(text)).toString('base64');
}

// Decrypt with private key  
function decryptWithPrivateKey(encryptedText, privateKey) {
    return crypto.privateDecrypt(privateKey, Buffer.from(encryptedText, 'base64')).toString();
}
```

### 4. Network Security
Protect network infrastructure dan communications.

#### Firewall Configuration:
```bash
# UFW (Ubuntu Firewall) examples
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow specific services
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow from specific IP
sudo ufw allow from 192.168.1.100 to any port 22

# Enable firewall
sudo ufw enable
```

#### Intrusion Detection:
```bash
# Install and configure Fail2Ban
sudo apt install fail2ban

# Configure SSH protection
sudo nano /etc/fail2ban/jail.local

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

## Secure Development Practices

### 1. Input Validation
```javascript
const validator = require('validator');

function validateUserInput(input) {
    const errors = [];
    
    // Check email format
    if (!validator.isEmail(input.email)) {
        errors.push('Invalid email format');
    }
    
    // Check password strength
    if (!validator.isStrongPassword(input.password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
    })) {
        errors.push('Password too weak');
    }
    
    // Sanitize input
    input.name = validator.escape(input.name);
    
    return {
        isValid: errors.length === 0,
        errors,
        sanitizedInput: input
    };
}
```

### 2. Secure Headers
```javascript
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true
    }
}));
```

### 3. Session Security
```javascript
const session = require('express-session');

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,      // HTTPS only
        httpOnly: true,    // Prevent XSS
        maxAge: 1800000,   // 30 minutes
        sameSite: 'strict' // CSRF protection
    }
}));
```

## Incident Response

### 1. Preparation
- Develop incident response plan
- Train response team
- Setup monitoring tools
- Create communication channels

### 2. Identification
```bash
# Log analysis untuk detect incidents
grep "FAILED LOGIN" /var/log/auth.log | tail -20

# Network monitoring
tcpdump -n -i eth0 'port 80 or port 443'

# Process monitoring
top -p $(pgrep -d',' suspicious_process)
```

### 3. Containment
- Isolate affected systems
- Preserve evidence
- Prevent spread of attack

### 4. Eradication
- Remove malware
- Close vulnerabilities
- Update security controls

### 5. Recovery
- Restore systems dari backups
- Monitor for recurring issues
- Gradually restore operations

### 6. Lessons Learned
- Document incident
- Update procedures
- Improve security controls

## Security Tools

### 1. Vulnerability Scanners
```bash
# Nmap for network scanning
nmap -sS -O 192.168.1.0/24

# Nikto for web vulnerabilities
nikto -h http://example.com

# OpenVAS for comprehensive scanning
openvas-start
```

### 2. Password Security
```javascript
const bcrypt = require('bcrypt');

// Hash password
async function hashPassword(plainPassword) {
    const saltRounds = 12;
    return await bcrypt.hash(plainPassword, saltRounds);
}

// Verify password
async function verifyPassword(plainPassword, hash) {
    return await bcrypt.compare(plainPassword, hash);
}

// Generate strong password
function generateStrongPassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    return Array.from(crypto.randomBytes(length))
        .map(byte => charset[byte % charset.length])
        .join('');
}
```

### 3. Security Monitoring
```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP'
});

// Security logging
function logSecurityEvent(event, details) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        ip: details.ip,
        userAgent: details.userAgent,
        severity: details.severity || 'INFO'
    };
    
    console.log('SECURITY_EVENT:', JSON.stringify(logEntry));
    
    // Send to SIEM system
    if (details.severity === 'HIGH') {
        alertSecurityTeam(logEntry);
    }
}
```

## Best Practices

### 1. Regular Updates
- Keep operating systems updated
- Update applications dan dependencies
- Apply security patches promptly

### 2. Backup Strategy
```bash
# Automated backups
#!/bin/bash
BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u root -p database_name > $BACKUP_DIR/database.sql

# File backup
tar -czf $BACKUP_DIR/files.tar.gz /important/directory

# Test backup integrity
tar -tzf $BACKUP_DIR/files.tar.gz > /dev/null && echo "Backup OK" || echo "Backup FAILED"
```

### 3. Security Training
- Regular security awareness training
- Phishing simulation exercises
- Incident response drills
- Security culture development

### 4. Compliance
- Understand regulatory requirements (GDPR, HIPAA, PCI-DSS)
- Implement required controls
- Regular compliance audits
- Document security procedures

Cybersecurity adalah ongoing process yang requires constant vigilance, regular updates, dan continuous learning. Invest dalam proper security measures sekarang untuk avoid costly incidents di masa depan.