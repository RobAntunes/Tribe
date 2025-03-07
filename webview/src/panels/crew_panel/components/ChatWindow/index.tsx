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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    // Log when loadingAgent changes
    useEffect(() => {
        console.log('ChatWindow loadingAgent:', loadingAgent);
    }, [loadingAgent]);

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
                    <div className="message-sender-info">
                        <span className="sender">{senderDisplay}</span>
                        {message.type === 'agent' && message.agentContext && (
                            <span className="sender-role">{message.agentContext.role}</span>
                        )}
                    </div>
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
                            {message.type === 'agent' && message.agentContext?.backstory && (
                                <div className="agent-context-tooltip">
                                    <div className="tooltip-icon" title="Agent backstory">i</div>
                                    <div className="tooltip-content">
                                        <h4>{message.agentContext.name || senderDisplay}</h4>
                                        <p className="agent-role">{message.agentContext.role}</p>
                                        <p className="agent-backstory">{message.agentContext.backstory}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="chat-window">
            <div className="messages-container" ref={messageListRef}>
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <div className="empty-chat-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272V20L7.87279 18.1272C9.10902 18.7663 10.5124 19.1272 12 19.1272C13.4876 19.1272 14.891 18.7663 16.1272 18.1272L20 20V16.1272C20.6391 14.891 21 13.4876 21 12" 
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div className="empty-chat-text">No messages yet. Start a conversation!</div>
                    </div>
                ) : (
                    <>
                        {messages.map(message => renderMessage(message))}
                        <div ref={messagesEndRef} />
                    </>
                )}
                
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
        </div>
    );
};