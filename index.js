import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { configDotenv } from 'dotenv';

configDotenv(); // Load environment variables

const app = express();
const server = createServer(app);
const io = new Server(server);

// To Serve static files for the client-side
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/chatdb', {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    // serverSelectionTimeoutMS: 15000,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Message Schema and Model
const messageSchema = new mongoose.Schema({
    user: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

// Read OpenAI API Key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to get response from OpenAI GPT model


//OPENAI IMPORT
const openai = new OpenAI({
    apiKey : process.env.OPENAI_API_KEY,
});

//AXIOS IMPORT
// const openai = new OpenAI();

async function getBotResponse(message) {
    try {
        // const response = await axios.post(
        const response = await openai.chat.completions.create(
            // 'https://api.openai.com/v1/chat/completions',
            {
                // model: 'text-davinci-003',
                
                messages: [
                    { role: "user", content: message }
                    // { "role": "user", "content": message }
                  ],
                model: 'gpt-4o-mini',
                // max_tokens: 250,
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error('Error fetching OpenAI response:', error);
        return "Sorry, I'm having trouble understanding you right now.";
    }
}

// Send chat history to user on connection
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    try {
        // Use async/await to handle the result of the query
        const messages = await Message.find().sort({ timestamp: 1 }).exec();
        socket.emit('chatHistory', messages);
    } catch (err) {
        console.error('Error retrieving chat history:', err);
    }

    // Handle incoming user messages
    socket.on('userMessage', async (message) => {
        console.log('User message:', message);

        // Save user message to MongoDB
        const userMessage = new Message({ user: 'User', content: message });
        await userMessage.save();

        // Get bot response from OpenAI API
        const botResponse = await getBotResponse(message);

        // Save bot response to MongoDB
        const botMessage = new Message({ user: 'Bot', content: botResponse });
        await botMessage.save();

        // Emit bot response to the user
        socket.emit('botResponse', botResponse);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});


// Start the server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

    // socket.on('userMessage', (message) => {
    //     console.log('User message:', message);

    //     // Bot Reply
    //     const botResponse = `Echo: ${message}`;
    //     socket.emit('botResponse', botResponse);
    // });