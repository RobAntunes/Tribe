import React, { useState, useRef, useEffect } from 'react';
import './styles.css';
import { Message, Agent } from '../../types';
import MarkdownIt from 'markdown-it';

// Initialize markdown-it instance with security options
const md = new MarkdownIt({
    html: false,        // Disable HTML tags in source
    xhtmlOut: false,    // Use '/' to close single tags (<br />)
    breaks: true,       // Convert '\n' in paragraphs into <br>
    linkify: true,      // Autoconvert URL-like text to links
    typographer: true,  // Enable smartquotes and other typographic replacements
});

// Safe markdown renderer component
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    // Preprocess content to handle escaped newlines
    const preprocessedContent = content
        ? content
            .replace(/\\n/g, '\n') // Replace escaped newlines with actual newlines
            .replace(/\\t/g, '    ') // Replace escaped tabs with spaces
        : '';
    
    // Use the markdown-it library to render the content
    const renderedHtml = md.render(preprocessedContent);
    
    return (
        <div 
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
};

interface ChatWindowProps {
    messages: Message[];
    onSendMessage?: (message: string) => void;
    placeholder?: string;
    disabled?: boolean;
    loadingAgent?: string; // New prop to track which agent is currently loading
    currentAgentId?: string | null;
    agents?: Agent[];
    messageListRef?: React.RefObject<HTMLDivElement>;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    messages,
    onSendMessage,
    placeholder = "Type a message...",
    disabled = false,
    loadingAgent = undefined,
    currentAgentId = null,
    agents = [],
    messageListRef = React.createRef<HTMLDivElement>()
}) => {
    const [currentMessage, setCurrentMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    // Log when loadingAgent changes
    useEffect(() => {
        console.log('ChatWindow loadingAgent:', loadingAgent);
    }, [loadingAgent]);

    const handleSend = () => {
        if (currentMessage.trim()) {
            onSendMessage?.(currentMessage.trim());
            setCurrentMessage('');
        }
    };

    const renderMessage = (message: Message) => {
        // Skip rendering if message has no content
        if (!message.content && message.status !== 'error') {
            return null;
        }
        
        const messageClass = `message ${message.type} ${message.status || ''}`;
        const senderDisplay = message.isVPResponse ? 'VP of Engineering' : message.sender;
        
        return (
            <div 
                key={message.id} 
                className={messageClass}
                data-vp={message.isVPResponse ? "true" : "false"}
            >
                <div className="message-header">
                    <span className="sender">{senderDisplay}</span>
                    <span className="timestamp">
                        {new Date(message.timestamp).toLocaleString()}
                    </span>
                </div>
                <div className="message-content">
                    {message.status === 'error' ? (
                        <div className="error-content">
                            <span className="error-icon">⚠️</span>
                            <span>{message.content}</span>
                        </div>
                    ) : (
                        <div className="message-text">
                            <MarkdownRenderer content={message.content || ''} />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="chat-window">
            <div className="messages-container">
                {messages.map(message => renderMessage(message))}
                <div ref={messagesEndRef} />
                
                {/* Loading indicator - positioned inside the messages container */}
                {loadingAgent && (
                    <div className="loading-indicator-container">
                        <div className="loading-indicator">
                            <div className="loading-spinner"></div>
                            <span>{loadingAgent} is thinking...</span>
                        </div>
                    </div>
                )}
            </div>
            <div className="input-container">
                <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !disabled && handleSend()}
                    placeholder={placeholder}
                    className="input-field"
                    disabled={disabled}
                />
                <button
                    onClick={handleSend}
                    disabled={!currentMessage.trim() || disabled}
                    className="button primary"
                >
                    Send
                </button>
            </div>
        </div>
    );
};