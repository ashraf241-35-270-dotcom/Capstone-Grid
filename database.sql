

CREATE DATABASE IF NOT EXISTS foodbridge;
USE foodbridge;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,        -- stored as bcrypt hash
    phone VARCHAR(20),
    role ENUM('donor', 'receiver', 'admin') NOT NULL DEFAULT 'receiver',
    address VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donations (
    donation_id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    food_name VARCHAR(150) NOT NULL,
    description TEXT,
    quantity VARCHAR(50) NOT NULL,          -- e.g. "10 kg", "20 plates"
    food_type ENUM('veg', 'non-veg', 'mixed') DEFAULT 'veg',
    expiry_time DATETIME NOT NULL,          -- how long food stays safe to eat
    pickup_address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status ENUM('available', 'requested', 'delivered', 'expired') DEFAULT 'available',
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id INT NOT NULL,
    receiver_id INT NOT NULL,
    request_status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donation_id) REFERENCES donations(donation_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
);
)
CREATE TABLE admin_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_table VARCHAR(50),
    target_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);
