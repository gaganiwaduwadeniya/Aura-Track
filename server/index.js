require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(helmet());

// MongoDB connection setup
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// User Schema definition for admin users
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  address: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Fixed Registration Schema to match the frontend
const registrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  address: { type: String },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  indexNumber: { type: String, required: true },
  degreeProgram: { type: String, required: true },
  intake: { type: String },
  photos: {
    front: { type: String, required: true },
    Smile: { type: String, required: true },
    withObject: { type: String, required: true },
    left: { type: String, required: true },
    right: { type: String, required: true }
  },
  verified: { type: Boolean, default: false },
  registrationDate: { type: Date, default: Date.now }
});

// Face Embedding Schema definition
const embeddingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
  embeddings: { type: Object, required: true }, // Store the embeddings as a JSON object
  createdAt: { type: Date, default: Date.now }
});

// Attendance Schema definition
const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
  indexNumber: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  degreeProgram: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  method: { type: String, default: 'Face Recognition' }
}, { timestamps: true });

// Add index for efficient queries
attendanceSchema.index({ userId: 1, timestamp: 1 });
attendanceSchema.index({ indexNumber: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
const Embedding = mongoose.model('Embedding', embeddingSchema);
const User = mongoose.model('User', userSchema);
const Registration = mongoose.model('Registration', registrationSchema);

// Route to sign up a new user (admin user)
app.post('/signup', async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      username, 
      password, 
      registrationNumber, 
      mobileNumber, 
      address 
    } = req.body;

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists. Please use a different email address.' });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different username.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      username,
      password: hashedPassword,
      registrationNumber,
      mobileNumber,
      address
    });

    await newUser.save();

    res.status(201).json({ 
      success: true,
      message: 'User created successfully.' 
    });

  } catch (error) {
    console.error('Error signing up:', error.message);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Route to log in a user using username and password
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.status(200).json({ 
      success: true,
      message: 'Login successful', 
      user: {
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        registrationNumber: user.registrationNumber,
        mobileNumber: user.mobileNumber,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Store verification codes temporarily (in production, use Redis or a database)
const verificationCodes = {};

// Route to handle forgot password request
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Received email for password reset:', email);
    // Check if email exists in the database
    const user = await User.findOne({ email });
      if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found in our records' 
      });
    }
    
    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the code with expiration (10 minutes)
    verificationCodes[email] = {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Password Reset</h2>
          <p>You requested to reset your password. Please use the following verification code:</p>
          <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
        </div>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending password reset email:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to send verification code'
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Verification code sent successfully'
      });
    });
    
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error processing password reset'
    });
  }
});

// Route to verify reset code
app.post('/verify-code', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    // Check if we have a verification code for this email
    if (!verificationCodes[email]) {
      return res.status(400).json({ 
        success: false, 
        error: 'No verification code found for this email' 
      });
    }
    
    // Check if the code is expired
    if (verificationCodes[email].expires < Date.now()) {
      delete verificationCodes[email]; // Clean up expired code
      return res.status(400).json({ 
        success: false, 
        error: 'Verification code has expired'
      });
    }
    
    // Check if the code matches
    if (verificationCodes[email].code !== verificationCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid verification code'
      });
    }
    
    // Code is valid
    res.status(200).json({ 
      success: true, 
      message: 'Verification code is valid'
    });
    
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error verifying code'
    });
  }
});

// Route to reset password
app.post('/reset-password', async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body;
    
    // Validate verification code again
    if (!verificationCodes[email] || 
        verificationCodes[email].expires < Date.now() || 
        verificationCodes[email].code !== verificationCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired verification code'
      });
    }
    
    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found'
      });
    }
    
    // Validate password
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long'
      });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user's password
    user.password = hashedPassword;
    await user.save();
    
    // Clean up the verification code
    delete verificationCodes[email];
    
    // Send password changed confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Password Reset Successful</h2>
          <p>Your password has been reset successfully.</p>
          <p>If you did not request this change, please contact our support team immediately.</p>
        </div>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending confirmation email:', error);
        // Continue with the response even if email fails
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Password reset successful'
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error resetting password'
    });
  }
});

// Route to resend verification code
app.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Email not found'
      });
    }
    
    // Generate a new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update or create verification code entry
    verificationCodes[email] = {
      code,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    };
    
    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Password Reset</h2>
          <p>You requested a new verification code. Please use the following code:</p>
          <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
        </div>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending verification code:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to send verification code'
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'New verification code sent successfully'
      });
    });
    
  } catch (error) {
    console.error('Error resending code:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error resending code'
    });
  }
});

// NEW ROUTE: Initial step of new user registration - save user details
app.post('/api/register/step1', async (req, res) => {
  try {
    const { firstName, lastName, address, mobile, email, indexNumber, degreeProgram, intake } = req.body;
    
    // Check if user with the same email or index number already exists
    const existingUser = await Registration.findOne({ 
      $or: [{ email }, { indexNumber }]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'A user with this email or index number already exists.' 
      });
    }
    
    // Validate mobile number
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid 10-digit mobile number' 
      });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address' 
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Step 1 validation successful'
    });
    
  } catch (error) {
    console.error('Error in step 1 registration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error processing registration step 1' 
    });
  }
});

// NEW ROUTE: Send verification code via email
app.post('/api/register/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store this code temporarily (in production, you might use Redis or another temporary storage)
    // For this example, we'll just send it back in the response (not secure for production)
    
    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verification Code for Registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Verification Code</h2>
          <p>Thank you for registering. Please use the following code to verify your email address:</p>
          <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
        </div>
      `
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending verification email:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to send verification email' 
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Verification code sent successfully',
        verificationCode: verificationCode // In production, don't send this back to client
      });
    });
    
  } catch (error) {
    console.error('Error sending verification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error sending verification code' 
    });
  }
});

// NEW ROUTE: Final registration - save all user data including photos
app.post('/api/register/complete', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      address,
      mobile,
      email,
      indexNumber,
      degreeProgram,
      intake,
      photos
    } = req.body;
    
    // Validation - ensure all required fields exist
    if (!firstName || !lastName || !mobile || !email || !indexNumber || !degreeProgram) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Check if user with the same email or index number already exists
    const existingUser = await Registration.findOne({ 
      $or: [{ email }, { indexNumber }]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'A user with this email or index number already exists.' 
      });
    }
    
    // Ensure all photos are included
    if (!photos || !photos.front || !photos.Smile || !photos.withObject || !photos.left || !photos.right) {
      return res.status(400).json({
        success: false,
        message: 'All required photos must be provided'
      });
    }
    
    // Create a new registration record
    const newRegistration = new Registration({
      firstName,
      lastName,
      address,
      mobile,
      email,
      indexNumber,
      degreeProgram,
      intake,
      photos,
      verified: true
    });
    
    // Save the registration
    await newRegistration.save();
    
    // Send a confirmation email
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Registration Confirmation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333; text-align: center;">Registration Successful</h2>
            <p>Dear ${firstName} ${lastName},</p>
            <p>Thank you for registering. Your information has been successfully saved in our system.</p>
            <p>Your details:</p>
            <ul>
              <li>Index Number: ${indexNumber}</li>
              <li>Program: ${degreeProgram}</li>
              <li>Email: ${email}</li>
            </ul>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        `
      };
      
      transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Continue with the registration process even if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      registrationId: newRegistration._id
    });
    
  } catch (error) {
    console.error('Error completing registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing registration'
    });
  }
});

// Route to get all registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find().select('-photos'); // Exclude photo data for performance
    res.status(200).json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching registrations'
    });
  }
});

// Route to get a specific registration by ID
app.get('/api/registrations/:id', async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    res.status(200).json({
      success: true,
      registration
    });
  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching registration'
    });
  }
});

// Add this route to your index.js file to check admin count
app.get('/admin/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ 
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Error getting admin count:', error.message);
    res.status(500).json({ error: 'Failed to get admin count' });
  }
});

// Route to fetch all registrations with photos and process them
app.get('/api/process-all-registrations', async (req, res) => {
  try {
    // Fetch all registrations with photos
    console.log('Fetching registrations...');
    const registrations = await Registration.find();
    
    console.log(`Found ${registrations.length} registrations`);
    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registrations found'
      });
    }
    
    // Format the data for the Python API
    console.log('Formatting image data...');
    const imagesData = [];
    for (const registration of registrations) {
      const personName = registration._id.toString(); // Use registration ID as person name
      console.log(`Processing registration for ID: ${personName}`);
      
      // Add each photo type to the images array
      if (registration.photos && typeof registration.photos === 'object') {
        Object.entries(registration.photos).forEach(([photoType, photoData]) => {
          imagesData.push({
            personName: personName,
            imageName: `${photoType}.jpg`,
            imageData: photoData
          });
        });
      } else {
        console.log(`No photos found for user ${personName}`);
      }
    }
    
    console.log(`Formatted ${imagesData.length} images`);
    
    // Call the Python API to process images
    console.log('Calling Python API at http://localhost:5001/api/process-images...');
    try {
      const pythonApiUrl = 'http://localhost:5001/api/process-images';
      const response = await axios.post(pythonApiUrl, {
        images: imagesData
      });
      
      console.log('Response from Python API:', response.status);
      
      if (!response.data || !response.data.embeddings) {
        return res.status(500).json({
          success: false,
          message: 'Failed to process images',
          pythonResponse: response.data
        });
      }
      
      // Store embeddings in database
      console.log('Storing embeddings in database...');
      for (const [personId, personEmbeddings] of Object.entries(response.data.embeddings)) {
        // Check if embeddings already exist for this user
        const existingEmbedding = await Embedding.findOne({ userId: personId });
        
        if (existingEmbedding) {
          // Update existing embeddings
          console.log(`Updating embeddings for user ${personId}`);
          existingEmbedding.embeddings = personEmbeddings;
          await existingEmbedding.save();
        } else {
          // Create new embeddings record
          console.log(`Creating new embeddings for user ${personId}`);
          const newEmbedding = new Embedding({
            userId: personId,
            embeddings: personEmbeddings
          });
          await newEmbedding.save();
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'All registrations processed successfully',
        embeddings: response.data.embeddings,
        logs: response.data.logs
      });
    } catch (apiError) {
      console.error('Error calling Python API:', apiError.message);
      if (apiError.response) {
        console.error('API response data:', apiError.response.data);
        console.error('API response status:', apiError.response.status);
      }
      throw new Error(`Python API error: ${apiError.message}`);
    }
    
  } catch (error) {
    console.error('Error processing registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing registrations',
      error: error.message
    });
  }
});

app.post('/api/create-embeddings', async (req, res) => {
  try {
    const { userId, image } = req.body;

    if (!userId || !image) {
      return res.status(400).json({
        success: false,
        message: 'User ID and image are required'
      });
    }

    // Verify the user exists in the Registration collection
    const user = await Registration.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if embeddings already exist for this user
    const existingEmbedding = await Embedding.findOne({ userId });
    if (existingEmbedding) {
      return res.status(400).json({
        success: false,
        message: 'Embeddings already exist for this user'
      });
    }

    // Call Python API to generate embeddings
    const pythonApiUrl = 'http://localhost:5001/api/generate-embeddings';
    const response = await axios.post(pythonApiUrl, {
      image: image
    });

    // Create and save new embedding
    const newEmbedding = new Embedding({
      userId: userId,
      embeddings: response.data.embeddings
    });

    await newEmbedding.save();

    res.status(201).json({
      success: true,
      message: 'Embeddings created successfully',
      embeddingId: newEmbedding._id
    });

  } catch (error) {
    console.error('Error creating embeddings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating embeddings',
      error: error.message
    });
  }
});

// Route to check if embeddings need to be processed
app.get('/api/check-embeddings', async (req, res) => {
  try {
    // Check if we have any registrations
    const registrationCount = await Registration.countDocuments();
    
    if (registrationCount === 0) {
      return res.json({
        success: true,
        needsProcessing: false,
        message: 'No registrations found, nothing to process'
      });
    }
    
    // Check if we have any embeddings
    const embeddingCount = await Embedding.countDocuments();
    
    // Get the newest registration timestamp
    const newestRegistration = await Registration.findOne().sort({ createdAt: -1 });
    
    // Get the newest embedding timestamp
    const newestEmbedding = await Embedding.findOne().sort({ createdAt: -1 });
    
    let needsProcessing = false;
    let reason = '';
    
    // If no embeddings exist at all but we have registrations
    if (embeddingCount === 0 && registrationCount > 0) {
      needsProcessing = true;
      reason = 'No embeddings found for existing registrations';
    } 
    // If we have fewer embeddings than registrations, some need processing
    else if (embeddingCount < registrationCount) {
      needsProcessing = true;
      reason = `Missing embeddings for some registrations (${embeddingCount}/${registrationCount})`;
    }
    // If newest registration is more recent than newest embedding, we need to process
    else if (newestRegistration && newestEmbedding && 
             newestRegistration.createdAt > newestEmbedding.createdAt) {
      needsProcessing = true;
      reason = 'New registrations found since last embedding processing';
    }
    
    res.json({
      success: true,
      needsProcessing,
      registrationCount,
      embeddingCount,
      reason
    });
    
  } catch (error) {
    console.error('Error checking embeddings status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking embeddings status',
      error: error.message
    });
  }
});

// Route to fetch the latest embeddings
app.get('/api/latest-embeddings', async (req, res) => {
  try {
    // Fetch all embeddings sorted by creation date (most recent first)
    const latestEmbeddings = await Embedding.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName indexNumber'); // Optionally populate user details
    
    if (!latestEmbeddings || latestEmbeddings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No embeddings found'
      });
    }
    
    // Transform embeddings to a more usable format
    const formattedEmbeddings = latestEmbeddings.map(embedding => ({
      userId: embedding.userId,
      userName: `${embedding.userId.firstName} ${embedding.userId.lastName}`,
      indexNumber: embedding.userId.indexNumber,
      embeddings: embedding.embeddings,
      createdAt: embedding.createdAt
    }));
    
    res.json({
      success: true,
      embeddings: formattedEmbeddings
    });
  } catch (error) {
    console.error('Error fetching latest embeddings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching embeddings',
      error: error.message
    });
  }
});

app.post('/api/recognize-face', async (req, res) => {
  try {
    const { image } = req.body;
    
    // Validate input
    if (!image) {
      return res.status(400).json({
        success: false,
        code: 'NO_IMAGE',
        message: 'No image provided for face recognition',
        debugHint: 'Ensure a valid base64 encoded image is sent'
      });
    }
    
    // Fetch all embeddings from the database
    const allEmbeddings = await Embedding.find();
    if (allEmbeddings.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'NO_EMBEDDINGS',
        message: 'No face data found in the system',
        debugHint: 'Ensure users have been registered and their face data processed'
      });
    }
    
    // Format embeddings for the Python API
    const embeddingsData = {};
    for (const embedding of allEmbeddings) {
      embeddingsData[embedding.userId] = embedding.embeddings;
    }
    
    // Call the Python API to recognize the face
    const pythonApiUrl = 'http://localhost:5001/api/recognize-face';
    let response;
    try {
      response = await axios.post(pythonApiUrl, {
        image: image,
        embeddings: embeddingsData
      });
    } catch (pythonApiError) {
      console.error('[CRITICAL] Python API Error:', pythonApiError);
      return res.status(500).json({
        success: false,
        code: 'PYTHON_API_ERROR',
        message: 'Face recognition service is currently unavailable',
        debugHint: 'Check Python backend service and connections'
      });
    }

    // Enhanced logging and debugging
    console.log("[DEBUG] Full Python API Response:", JSON.stringify(response.data, null, 2));
    
    // Define confidence thresholds with more granular messaging
    const VERY_HIGH_CONFIDENCE = 0.80;
    const HIGH_CONFIDENCE = 0.70;
    const MEDIUM_CONFIDENCE = 0.50;
    const LOW_CONFIDENCE = 0.30;

    // Detailed recognition logic with comprehensive messaging
    let recognitionOutcome = {
      success: false,
      code: 'UNRECOGNIZED',
      message: 'Face not recognized',
      debugHint: 'Unable to match face with any registered user',
      confidenceLevel: 'None'
    };

    // Check if a potential match was found
    if (response.data.recognizedName !== 'Unknown') {
      const similarity = response.data.similarity;

      try {
        const userId = response.data.recognizedName;
        const user = await Registration.findById(userId);

        if (!user) {
          recognitionOutcome = {
            success: false,
            code: 'USER_NOT_FOUND',
            message: 'Matched face but no user record exists',
            debugHint: 'Potential data inconsistency in user registration',
            confidenceLevel: 'Unknown'
          };
        } else {
          // Confidence-based messaging
          if (similarity >= VERY_HIGH_CONFIDENCE) {
            recognitionOutcome = {
              success: true,
              code: 'VERY_HIGH_MATCH',
              message: `High confidence match for ${user.firstName} ${user.lastName}`,
              confidenceLevel: 'Very High',
              confidencePercentage: Math.round(similarity * 100)
            };
          } else if (similarity >= HIGH_CONFIDENCE) {
            recognitionOutcome = {
              success: true,
              code: 'HIGH_MATCH',
              message: `Strong match for ${user.firstName} ${user.lastName}`,
              confidenceLevel: 'High',
              confidencePercentage: Math.round(similarity * 100)
            };
          } else if (similarity >= MEDIUM_CONFIDENCE) {
            recognitionOutcome = {
              success: true,
              code: 'MEDIUM_MATCH',
              message: `Reasonable match for ${user.firstName} ${user.lastName}`,
              confidenceLevel: 'Medium',
              confidencePercentage: Math.round(similarity * 100),
              debugHint: 'Consider manual verification'
            };
          } else if (similarity >= LOW_CONFIDENCE) {
            recognitionOutcome = {
              success: false,
              code: 'LOW_MATCH',
              message: 'Weak face match detected',
              confidenceLevel: 'Low',
              confidencePercentage: Math.round(similarity * 100),
              debugHint: 'Retake photo or seek administrator assistance'
            };
          }

          // If successful match, create attendance record
          if (recognitionOutcome.success) {
            try {
              const attendance = new Attendance({
                userId: user._id,
                indexNumber: user.indexNumber,
                firstName: user.firstName,
                lastName: user.lastName,
                degreeProgram: user.degreeProgram,
                timestamp: new Date(),
                method: 'Face Recognition',
                confidence: similarity
              });

              await attendance.save();
              recognitionOutcome.attendanceRecorded = true;
            } catch (attendanceError) {
              recognitionOutcome.attendanceRecorded = false;
              recognitionOutcome.debugHint = 'Failed to record attendance';
            }
          }

          // Attach user details if match is successful
          if (recognitionOutcome.success) {
            recognitionOutcome.userDetails = {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              indexNumber: user.indexNumber,
              degreeProgram: user.degreeProgram,
              similarity: similarity
            };
          }
        }
      } catch (userLookupError) {
        console.error('User lookup error:', userLookupError);
        recognitionOutcome = {
          success: false,
          code: 'SYSTEM_ERROR',
          message: 'Internal error during face recognition',
          debugHint: 'Database lookup failed',
          confidenceLevel: 'None'
        };
      }
    }

    // Log the final recognition outcome
    console.log('[RECOGNITION OUTCOME]', JSON.stringify(recognitionOutcome, null, 2));

    // Send comprehensive response
    res.status(200).json(recognitionOutcome);
    
  } catch (error) {
    console.error('Critical error in face recognition:', error);
    res.status(500).json({
      success: false,
      code: 'CRITICAL_ERROR',
      message: 'Unexpected error during face recognition',
      debugHint: 'Check server logs for detailed error information'
    });
  }
});

// Route to record attendance
app.post('/api/record-attendance', async (req, res) => {
  try {
    const { userId, timestamp } = req.body;
    
    console.log("[DEBUG] Received userId:", userId);
    console.log("[DEBUG] Received timestamp:", timestamp);

    // Additional validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Find the student by ID
    const student = await Registration.findById(userId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Log student details for verification
    console.log("[DEBUG] Found student:", {
      id: student._id,
      indexNumber: student.indexNumber,
      firstName: student.firstName,
      lastName: student.lastName
    });
    
    // Create a new attendance record
    const attendance = new Attendance({
      userId: student._id,  // Use the actual MongoDB _id
      indexNumber: student.indexNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      degreeProgram: student.degreeProgram,
      timestamp: timestamp || new Date(),
      method: 'Face Recognition'
    });
    
    // Save and log the saved attendance
    const savedAttendance = await attendance.save();
    console.log("[DEBUG] Saved attendance record:", savedAttendance);
    
    res.status(200).json({
      success: true,
      message: 'Attendance recorded successfully',
      attendance: savedAttendance
    });
    
  } catch (error) {
    console.error('Detailed error recording attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Server error recording attendance',
      errorDetails: error.message,
      errorStack: error.stack
    });
  }
});

// Route to get attendance records with filtering options
app.get('/api/attendance', async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { date, degreeProgram } = req.query;
    
    // Build the query object
    let query = {};
    
    // Filter by date if provided
    if (date) {
      // Create start and end of the requested date
      const startDate = new Date(date);
      // Reset timezone offset to avoid date shifting
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      
      query.timestamp = { $gte: startDate, $lte: endDate };
    }
    
    // Filter by degree program if provided and not 'all'
    if (degreeProgram && degreeProgram !== 'all') {
      query.degreeProgram = degreeProgram;
    }

    console.log("Query:", JSON.stringify(query)); // Add logging for debugging

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query)
      .sort({ timestamp: -1 })
      .lean();

    console.log("Found records:", attendanceRecords.length); // Log the count
    
    // Calculate status for each student
    const processedRecords = attendanceRecords.map(record => {
      // Get time from timestamp
      const checkInTime = new Date(record.timestamp);
      const hours = checkInTime.getHours();
      const minutes = checkInTime.getMinutes();
      
      // Determine status (example logic - adjust as needed)
      let status = "Present";
      if (hours > 9 || (hours === 9 && minutes > 0)) {
        status = "Late";
      }
      
      return {
        id: record.indexNumber,
        name: `${record.firstName} ${record.lastName}`,
        degree: record.degreeProgram,
        status: status,
        checkInTime: checkInTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true
        })
      };
    });

    res.status(200).json({
      success: true,
      data: processedRecords
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance records: ' + error.message 
    });
  }
});

// Route to get attendance summary stats
app.get('/api/attendance/summary', async (req, res) => {
  try {
    const { date, degreeProgram } = req.query;
    
    // Build the query object
    let query = {};
    
    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setUTCHours(23, 59, 59, 999);
      
      query.timestamp = { $gte: startDate, $lte: endDate };
    }
    
    // Filter by degree program if provided and not 'all'
    if (degreeProgram && degreeProgram !== 'all') {
      query.degreeProgram = degreeProgram;
    }

    console.log("Summary query:", JSON.stringify(query)); // Add logging
    
    // Get all attendance records for the filters
    const attendanceRecords = await Attendance.find(query).lean();
    console.log("Found attendance records:", attendanceRecords.length);
    
    // Get list of students who should be present
    let registrationQuery = {};
    if (degreeProgram && degreeProgram !== 'all') {
      registrationQuery.degreeProgram = degreeProgram;
    }
    
    const registeredStudents = await Registration.find(registrationQuery)
      .select('indexNumber firstName lastName degreeProgram')
      .lean();
    
    console.log("Registered students:", registeredStudents.length);
    
    // Calculate present, late, and absent
    const presentStudents = [];
    const lateStudents = [];
    const absentStudentIds = new Set(registeredStudents.map(student => student.indexNumber));
    
    // Process each attendance record
    attendanceRecords.forEach(record => {
      const checkInTime = new Date(record.timestamp);
      const hours = checkInTime.getHours();
      const minutes = checkInTime.getMinutes();
      
      // Remove from absent set
      absentStudentIds.delete(record.indexNumber);
      
      // Check if late or present
      if (hours > 9 || (hours === 9 && minutes > 0)) {
        lateStudents.push(record.indexNumber);
      } else {
        presentStudents.push(record.indexNumber);
      }
    });
    
    // Return summary statistics
    res.status(200).json({
      success: true,
      summary: {
        total: registeredStudents.length,
        present: presentStudents.length,
        late: lateStudents.length,
        absent: absentStudentIds.size
      }
    });
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get attendance summary: ' + error.message 
    });
  }
});

// Route to download attendance records in CSV format
app.get('/api/attendance/download', async (req, res) => {
  try {
    const { date, degreeProgram } = req.query;
    
    // Build the query object
    let query = {};
    
    // Filter by date if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.timestamp = { $gte: startDate, $lte: endDate };
    }
    
    // Filter by degree program if provided and not 'all'
    if (degreeProgram && degreeProgram !== 'all') {
      query.degreeProgram = degreeProgram;
    }

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(query).lean();
    
    // Get all registered students for comparison
    let registrationQuery = {};
    if (degreeProgram && degreeProgram !== 'all') {
      registrationQuery.degreeProgram = degreeProgram;
    }
    
    const registeredStudents = await Registration.find(registrationQuery)
      .select('indexNumber firstName lastName degreeProgram')
      .lean();
    
    // Create a map of registered students
    const studentMap = new Map();
    registeredStudents.forEach(student => {
      studentMap.set(student.indexNumber, {
        firstName: student.firstName,
        lastName: student.lastName,
        degreeProgram: student.degreeProgram,
        status: 'Absent',
        checkInTime: ''
      });
    });
    
    // Update the map with attendance information
    attendanceRecords.forEach(record => {
      const checkInTime = new Date(record.timestamp);
      const hours = checkInTime.getHours();
      const minutes = checkInTime.getMinutes();
      
      let status = 'Present';
      if (hours > 9 || (hours === 9 && minutes > 0)) {
        status = 'Late';
      }
      
      // If the student exists in our map, update their info
      if (studentMap.has(record.indexNumber)) {
        const studentInfo = studentMap.get(record.indexNumber);
        studentInfo.status = status;
        studentInfo.checkInTime = checkInTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true
        });
      }
    });
    
    // Convert to array of CSV rows
    const csvRows = [
      'ID,Name,Degree,Status,Check-in Time'
    ];
    
    studentMap.forEach((info, indexNumber) => {
      csvRows.push(`${indexNumber},"${info.firstName} ${info.lastName}",${info.degreeProgram},${info.status},${info.checkInTime}`);
    });
    
    // Join rows with newlines
    const csvContent = csvRows.join('\n');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_${degreeProgram || 'AllDegrees'}_${date || 'AllDates'}.csv`);
    
    // Send the CSV data
    res.send(csvContent);
  } catch (error) {
    console.error('Error downloading attendance records:', error.message);
    res.status(500).json({ error: 'Failed to download attendance records' });
  }
});

// Get all users route
app.get('/api/registrations', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    
    // Format the data to match your frontend expectations
    const formattedUsers = users.map(user => ({
      name: user.fullName,
      username: user.username,
      email: user.email,
      registrationDate: user.registrationDate || new Date(),
      active: user.active !== undefined ? user.active : true,
      photoUrl: user.photoUrl || ""
    }));
    
    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Route to delete a registration
app.delete('/api/registrations/:id', async (req, res) => {
  try {
    const deletedRegistration = await Registration.findByIdAndDelete(req.params.id);
    
    if (!deletedRegistration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Registration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting registration'
    });
  }
});

// Analytics Routes

// Route to get monthly attendance trend
app.get('/api/analytics/monthly-attendance', async (req, res) => {
  try {
    const { degreeProgram } = req.query;

    // Build query for filtering
    const query = degreeProgram && degreeProgram !== 'all' 
      ? { degreeProgram: degreeProgram } 
      : {};

    // Group attendance by month and calculate present/absent counts
    const monthlyAttendance = await Attendance.aggregate([
      { 
        $match: query 
      },
      { 
        $group: {
          _id: { 
            month: { $month: '$timestamp' },
            year: { $year: '$timestamp' }
          },
          present: { $sum: 1 },
          absent: { $sum: 0 }  // You'll need a more complex calculation for accurate absences
        }
      },
      { 
        $sort: { '_id.year': 1, '_id.month': 1 } 
      }
    ]);

    // Convert month numbers to names
    const monthNames = [
      'January', 'February', 'March', 'April', 
      'May', 'June', 'July', 'August', 
      'September', 'October', 'November', 'December'
    ];

    const formattedAttendance = monthlyAttendance.map(item => ({
      month: monthNames[item._id.month - 1],
      present: item.present,
      absent: item.absent
    }));

    res.status(200).json({
      success: true,
      data: formattedAttendance
    });
  } catch (error) {
    console.error('Error fetching monthly attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch monthly attendance: ' + error.message 
    });
  }
});

// Route to get student distribution by degree program
app.get('/api/analytics/student-distribution', async (req, res) => {
  try {
    const studentDistribution = await Registration.aggregate([
      { 
        $group: {
          _id: '$degreeProgram',
          value: { $sum: 1 }
        }
      }
    ]);

    const formattedDistribution = studentDistribution.map(item => ({
      name: item._id,
      value: item.value
    }));

    res.status(200).json({
      success: true,
      data: formattedDistribution
    });
  } catch (error) {
    console.error('Error fetching student distribution:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student distribution: ' + error.message 
    });
  }
});

// Route to get overall attendance summary
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const { degreeProgram } = req.query;

    // Build query for filtering
    const query = degreeProgram && degreeProgram !== 'all' 
      ? { degreeProgram: degreeProgram } 
      : {};

    // Total registered students
    const totalStudents = await Registration.countDocuments(query);

    // Unique students who have attendance records
    const uniqueAttendanceStudents = await Attendance.distinct('indexNumber', query);

    // Attendance records
    const attendanceRecords = await Attendance.find(query);

    // Calculate average attendance per student
    const averageAttendance = totalStudents > 0 
      ? (uniqueAttendanceStudents.length / totalStudents * 100).toFixed(1) 
      : 0;

    // Find best attendance month
    const monthlyAttendance = await Attendance.aggregate([
      { $match: query },
      { 
        $group: {
          _id: { 
            month: { $month: '$timestamp' },
            year: { $year: '$timestamp' }
          },
          uniqueStudents: { $addToSet: '$indexNumber' },
          count: { $sum: 1 }
        }
      },
      { 
        $project: {
          month: '$_id.month',
          year: '$_id.year',
          uniqueStudentsCount: { $size: '$uniqueStudents' },
          count: 1
        }
      },
      { $sort: { uniqueStudentsCount: -1 } },
      { $limit: 1 }
    ]);

    const monthNames = [
      'January', 'February', 'March', 'April', 
      'May', 'June', 'July', 'August', 
      'September', 'October', 'November', 'December'
    ];

    const bestAttendanceMonth = monthlyAttendance.length > 0 
      ? monthNames[monthlyAttendance[0].month - 1]
      : 'N/A';

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        uniqueAttendanceStudents: uniqueAttendanceStudents.length,
        averageAttendance: `${averageAttendance}%`,
        bestAttendanceMonth
      }
    });
  } catch (error) {
    console.error('Error fetching attendance overview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attendance overview: ' + error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});