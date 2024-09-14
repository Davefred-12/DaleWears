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
    purchasedProducts: [{ productId: Number, quantity: Number, purchasedAt: Date }]
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
        imageUrl: '/Images/phone1.png'
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
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        req.session.username = user.username;
        res.redirect('/thankyou');
    } catch (error) {
        console.log('Registration error:', error);
        res.redirect('/register');
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


// Route to display the checkout
app.get('/checkout', checkAuth, (req, res) => {
    res.render('checkout', { cart, user: req.session.user });
    res.redirect('/cart');

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



// Forgot-Password page
app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

app.post('/forgot-password', async (req, res) => {
    const email = req.body.email;
    console.log('Received email in forgot-password route:', email);

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        // Your code to generate the verification code and send the email
        const verificationCode = generateToken(); // Ensure this function is defined and used correctly
        await sendResetEmail(email, verificationCode);
        console.log('Generated Verification Code:', verificationCode);
        res.status(200).json({ message: 'Verification code sent successfully!' });
    } catch (error) {
        console.error('Error processing forgot password request:', error);
        res.status(500).json({ message: 'Error processing forgot password request.' });
    }
});

// Payment callback route
// app.get('/payment/callback', (req, res) => {
//     const { reference } = req.query;

//     const headers = {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         'Content-Type': 'application/json'
//     };

//     axios.get(`https://api.paystack.co/transaction/verify/${reference}`, { headers })
//     .then(response => {
//         if (response.data.data.status === 'success') {
//             // Move items from cart to purchased items
//             purchasedItems.push(...cart);
//             cart = [];
//             res.redirect('/dashboard');
//         } else {
//             res.send('Payment was not successful');
//         }
//     })
//     .catch(error => {
//         console.error(error);
//         res.send('An error occurred while verifying payment');
//     });
// });




// Verify Password page
app.get('/verify', (req, res) => {
    const { email } = req.query;
    console.log('Received email in verify route:', email); // Debugging log

    if (!email) {
        return res.status(400).send('Email query parameter is missing.');
    }

    res.render('verify', { email });
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




// Reset password page
app.get('/reset-password', (req, res) => {
    const { email } = req.query;
    console.log('Received email in reset-password route:', email); // Debugging log

    if (!email) {
        return res.status(400).send('Email query parameter is missing.');
    }

    res.render('reset-password', { email });
});


app.post('/reset-password', async (req, res) => {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match.');
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).send('Invalid email.');
        }

        // Update the user's password
        user.password = password;
        user.resetCode = null; // Clear the reset code
        user.resetCodeExpiry = null; // Clear the expiry
        await user.save();

        res.send('Password successfully reset.');
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).send('Server error. Please try again later.');
    }
});

// Profile page
app.get('/profile', checkAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate('purchasedProducts.productId');
        res.render('profile', { title: 'Profile', user });
    } catch (err) {
        console.log('Error fetching user:', err);
        res.redirect('/');
    }
});


app.post('/profile', checkAuth, upload.single('profilePicture'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId);
        
        if (req.file) {
            user.profilePicture = `/uploads/${req.file.filename}`;
        }

        await user.save();
        res.redirect('/profile');
    } catch (error) {
        console.log('Error updating profile:', error);
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
