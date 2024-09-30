const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();
const port = 3000;
const axios = require('axios')
const path = require('path');
const app = express();

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Initialize multer with the storage configuration
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'adeleyepamilerin9@gmail.com',
        pass: process.env.EMAIL_PASSWORD // Consider using environment variables
    }
});



// Generate a 6-digit numeric verification code
const generateToken = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric code
};

const sendResetEmail = async (userEmail, resetToken) => {
    const mailOptions = {
        from: 'adeleyepamilerin9@gmail.com',
        to: userEmail,
        subject: 'Password Reset Verification Code',
        text: `Your password reset verification code is: ${resetToken}. This code is valid for 1 hour. If you do not request for this code, kindly discard it and guide your gmail`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);

        await User.updateOne(
            { email: userEmail },
            {
                resetCode: resetToken,
                resetCodeExpiry: Date.now() + 3600000 // 1 hour from now
            }
        );
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Email sending failed');
    }
};


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '/images/default-profile.png' },
    resetCode: String,
    resetCodeExpiry: Date,
        purchases: [{
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            quantity: Number,
            purchaseDate: { type: Date, default: Date.now }
        }]
    });


const User = mongoose.model('User', userSchema);


// Middleware setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/uploads', express.static('public/uploads'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


// Middleware to Pass Profile Picture to Views
app.use((req, res, next) => {
    if (req.session.userId) {
        User.findById(req.session.userId).then(user => {
            res.locals.username = user.username;
            res.locals.profilePicture = user.profilePicture || '/images/default-profile.png';
            next();
        }).catch(err => {
            console.error(err);
            next();
        });
    } else {
        res.locals.username = null;
        res.locals.profilePicture = null;
        next();
    }
});

// Middleware to make the username available in all templates
app.use((req, res, next) => {
    res.locals.username = req.session.username || null;
    next();
});

// Middleware to check if the user is authenticated
const checkAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

const products = [
    {
        id: 1,
        name: 'Spectra Nova X5',
        price: 100,
        description: 'A sleek and powerful smartphone featuring a 6.7-inch OLED display, 108MP quad-camera system, 5G connectivity, and a 5000mAh battery for all-day performance and stunning photography.',
        imageUrl: '/Images/pz.jpg'
    },
    {
        id: 2,
        name: 'Astra Prime S10',
        price: 100,
        description: 'Experience the future with Astra Prime S10, boasting an 8K video recording, ultra-fast Snapdragon 888 processor, 120Hz refresh rate, and advanced AI capabilities for an immersive and intelligent user experience.',
        imageUrl: '/Images/phone2.png'
    },
    {
        id: 3,
        name: 'Nimbus Edge P9',
        price: 100,
        description: 'Nimbus Edge P9 combines style and substance with a 6.5-inch edge-to-edge display, dual stereo speakers, 64MP triple cameras, and an adaptive battery that intelligently optimizes power consumption.',
        imageUrl: '/Images/phone3.png'
    },
    {
        id: 4,
        name: 'Vortex Titan Z7',
        price: 100,
        description: 'Elevate your mobile experience with Vortex Titan Z7, offering a 7-inch Super AMOLED screen, cutting-edge 5G technology, 50W fast charging, and a pro-grade 48MP camera for stunning clarity in every shot.',
        imageUrl: '/Images/phone4.png'
    },
    {
        id: 5,
        name: 'Samsung 520',
        price: 100,
        description: 'Elevate your mobile experience with Vortex Titan Z7, offering a 7-inch Super AMOLED screen, cutting-edge 5G technology, 50W fast charging, and a pro-grade 48MP camera for stunning clarity in every shot.',
        imageUrl: '/images/phone5.png'
    },
    {
        id: 6,
        name: 'Iphone',
        price: 100,
        description: 'Nimbus Edge P9 combines style and substance with a 6.5-inch edge-to-edge display, dual stereo speakers, 64MP triple cameras, and an adaptive battery that intelligently optimizes power consumption.',
        imageUrl: '/Images/phone3.png'
    },
];




let cart = [];
let purchasedItems = []; // To track purchased items
let savedItem = []; // To track saved items

// Routes
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('register', { error: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect('/thankyou');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});


app.get('/thankyou', (req, res) => {
    res.render('thankyou', { title: 'Thank You' });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            req.session.username = user.username;
            res.redirect('/');
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        console.log('Login error:', error);
        res.redirect('/login');
    }
});

// Landing page, visible to all users
app.get('/', (req, res) => {
    res.render('home', { title: 'Home' });
});

// Policy page, visible to all users
app.get('/policy', (req, res) => {
    res.render('policy', { title: 'Policy' });
});

// About page, visible to all users
app.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
});

// Contact page, visible to all users
app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact' });
});



// Products route, visible to all users
app.get('/products', (req, res) => {
    res.render('product', { products, user: req.session.user });
});


// Route to add a product to the cart
app.post('/add-to-cart', (req, res, next) => {
    const { productId } = req.body;
    const product = products.find(p => p.id === parseInt(productId));

    if (product) {
        if (!req.session.cart) {
            req.session.cart = [];
        }

        const existingProduct = req.session.cart.find(p => p.id === product.id);

        if (existingProduct) {
            existingProduct.quantity += 1;
        } else {
            req.session.cart.push({ ...product, quantity: 1 });
        }

        res.redirect('/cart');
    } else {
        res.status(404).send('Product not found');
    }
});







// Route to handle removing items from the cart
app.post('/remove-from-cart', (req, res) => {
    const { productId } = req.body;
    cart = cart.filter(product => product.id !== parseInt(productId));
    res.redirect('/cart');
});


// Cart route, visible to all users
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    const user = req.session.user || null;

    // Render without products if not needed
    res.render('cart', { cart, user });
});


// Save cart to user's profile
app.post('/checkout', checkAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.cart = req.session.cart; // Store the current session cart in the user's profile
    await user.save();
    res.redirect('/payment'); // Redirect to payment page after saving cart
});


// Payment processing logic
app.post('/pay', checkAuth, (req, res) => {
    const { email, amount } = req.body;

    const headers = {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    };

    axios.post('https://api.paystack.co/transaction/initialize', {
        email,
        amount: amount * 100,  // Paystack expects the amount in kobo
        callback_url: 'http://localhost:3000/payment/callback'
    }, { headers })
    .then(response => {
        res.redirect(response.data.data.authorization_url);
    })
    .catch(error => {
        console.error(error);
        res.send('An error occurred while initializing payment');
    });
});

app.get('/payment/callback', async (req, res) => {
    const { reference } = req.query;
    // Verify transaction status using Paystack API
    try {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
            }
        });
        // Process response
        if (response.data.data.status === 'success') {
            // Save the purchase to the user’s profile
            // Redirect to success page
        } else {
            // Handle failed payment
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).send('Error processing payment callback');
    }
});

// Forgot-Password page
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});
app.post('/forgot-password', async (req, res) => {
    const email = req.body.email;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const verificationCode = generateToken();
        await sendResetEmail(email, verificationCode);

        // Redirect to the verification page with email as a query parameter
        res.redirect(`/verify-reset?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('Error in forgot-password:', error.message); // Log the error message
        return res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
});



// Reset Password Page
app.get('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const user = await User.findOne({ resetCode: token, resetCodeExpiry: { $gt: Date.now() } });

    if (!user) {
        return res.status(400).render('reset-password', { message: 'Invalid or expired token.' });
    }

    res.render('reset-password', { title: 'Reset Password', token });
});

// Reset Password Logic
app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        const user = await User.findOne({ resetCode: token, resetCodeExpiry: { $gt: Date.now() } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }

        // Hash the new password and save it
        user.password = await bcrypt.hash(password, 10);
        user.resetCode = undefined; // Clear the reset code
        user.resetCodeExpiry = undefined; // Clear the expiry date
        await user.save();

        res.redirect('/login'); // Redirect to login page after successful password reset
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
});

// Ensure to render the correct views for these routes
app.get('/reset-password', (req, res) => {
    res.render('reset-password', { title: 'Reset Password' });
});


app.get('/verify-reset', async (req, res) => {
    const { email } = req.query; // Extracting email from query parameters

    console.log('Received email in verify route:', email); // Log the email to check its value

    if (!email) {
        return res.status(400).send('Email query parameter is missing.');
    }

    // Render the verification page
    res.render('verify-reset', { email });
});


app.post('/verify', async (req, res) => {
    const { email, code } = req.body;
    console.log('Received email and code in verify POST route:', email, code); // Debugging log

    try {
        const user = await User.findOne({ email });
        if (!user || user.resetCode !== code || user.resetCodeExpiry < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired verification code.' });
        }

        // Redirect to reset-password page with email as a query parameter
        res.redirect(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

app.get('/profile', checkAuth, (req, res) => {
    User.findById(req.session.userId)
        .populate('purchases.productId') // Populate product details if necessary
        .then(user => {
            res.render('profile', { user, title: 'Your Profile' });
        })
        .catch(err => {
            console.error('Error fetching user data:', err);
            res.redirect('/login');
        });
});


app.post('/profile', upload.single('profilePicture'), async (req, res) => {
    try {
        // Update user's profile picture and info if uploaded
        const updatedData = {};
        if (req.file) {
            updatedData.profilePicture = `/uploads/${req.file.filename}`;
        }
        await User.findByIdAndUpdate(req.session.userId, updatedData);
        res.redirect('/profile');
    } catch (err) {
        console.error('Error updating profile:', err);
        res.redirect('/profile');
    }
});

// Update-profile page
app.get('/update-profile', checkAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('update-profile', { user });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.redirect('/profile');
    }
});

app.post('/update-profile', checkAuth, async (req, res) => {
    const userId = req.session.userId; // Assuming the user ID is stored in the session
    const {
        fullName,
        email,
        phone,
        dob,
        gender,
        password,
        shippingAddress,
        billingAddress,
        notifications,
        language,
        paymentMethod,
        securityQuestion,
        securityAnswer
    } = req.body;

    const profilePicture = req.file ? req.file.filename : null;

    // Hash the new password if provided
    let hashedPassword;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    try {
        const updateData = {
            fullName,
            email,
            phone,
            dob,
            gender,
            shippingAddress,
            billingAddress,
            notifications,
            language,
            paymentMethod,
            securityQuestion,
            securityAnswer,
        };

        if (profilePicture) {
            updateData.profilePicture = profilePicture;
        }

        if (password) {
            updateData.password = hashedPassword;
        }

        await User.findByIdAndUpdate(userId, updateData);
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/update-profile');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
