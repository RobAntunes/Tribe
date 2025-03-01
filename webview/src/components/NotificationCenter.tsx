import React from 'react';
import { Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface Notification {
    id: string;
    type: 'alert' | 'info' | 'success';
    message: string;
    timestamp: Date;
    read: boolean;
}

interface NotificationCenterProps {
    notifications: Notification[];
    onNotificationRead: (id: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onNotificationRead }) => {
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="notification-center">
            <div className="notification-badge">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="notification-count">{unreadCount}</span>
                )}
            </div>
            <div className="notification-list">
                {notifications.map(notification => (
                    <div 
                        key={notification.id} 
                        className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                        onClick={() => onNotificationRead(notification.id)}
                    >
                        {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {notification.type === 'alert' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {notification.type === 'info' && <Info className="w-4 h-4 text-blue-500" />}
                        <div className="notification-content">
                            <p className="notification-message">{notification.message}</p>
                            <span className="notification-time">
                                {new Date(notification.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotificationCenter;
