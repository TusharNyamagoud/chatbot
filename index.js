import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { configDotenv } from 'dotenv';

configDotenv(); // Load environment variables

const app = express();
const server = createServer(app);
const io = new Server(server);

// To Serve static files for the client-side
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/chatdb', {})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Message Schema and Model
const messageSchema = new mongoose.Schema({
    user: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

// Read GEMINI API Key from environment
const GEMINI_API_KEY = process.env.GEMINI;

// Confirmation tracker
let isAwaitingClearConfirmation = false;

// Function to get response from Gemini  model

async function getBotResponse(message) {
    try {
            if (message === '/clear' && !isAwaitingClearConfirmation) {
                // Ask for confirmation to clear the messages
                isAwaitingClearConfirmation = true;
                return "Are you sure you want to clear all messages? Type '/yes' to confirm.";
            } 
            
            else if (message === '/yes' && isAwaitingClearConfirmation){
                // Clear all messages after confirmation
                const deleteResult = await Message.deleteMany({});
                console.log('Messages cleared:', deleteResult.deletedCount);
                isAwaitingClearConfirmation = false;
                return "All messages have been cleared.";
            } 
            
            else {
                const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                const result = await model.generateContent(message)
                return (result.response.text());
            }
            
    } catch (error) {
        console.error('Error fetching Gemini response:', error);
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

       // Get bot response from Gemini API
       const botResponse = await getBotResponse(message);

       if (message === '/clear') {
            // Emit an event to clear the chat screen for the user
            io.emit('clearScreen'); // Send this to client to clear the screen
        } else {
            // Save user message to MongoDB
            const userMessage = new Message({ user: 'User', content: message });
            await userMessage.save();

            // Save bot response to MongoDB
            const botMessage = new Message({ user: 'Bot', content: botResponse });
            await botMessage.save();
        }

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
