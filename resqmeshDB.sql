CREATE DATABASE resqmesh;
USE resqmesh;

CREATE TABLE emergency_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,

    victim_name VARCHAR(100),
    phone VARCHAR(20),

    latitude DOUBLE,
    longitude DOUBLE,

    emergency_type VARCHAR(50),

    message TEXT,

    network_used VARCHAR(50),

    status ENUM('Pending','Processing','Processed') DEFAULT 'Pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE processed_incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,

    message_id INT,

    severity ENUM('Low','Medium','High','Critical'),

    ai_summary TEXT,

    rescue_team VARCHAR(100),

    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id)
        REFERENCES emergency_messages(id)
        ON DELETE CASCADE
);

SHOW TABLES;

INSERT INTO emergency_messages
(
victim_name,
phone,
latitude,
longitude,
emergency_type,
message,
network_used
)
VALUES
(
'Rahul',
'9876543210',
17.3850,
78.4867,
'Accident',
'Major accident near highway',
'BLE Mesh'
);

SELECT * FROM emergency_messages;
SELECT * FROM processed_incidents;
SELECT id, status FROM emergency_messages;
ALTER TABLE emergency_messages
ADD COLUMN fingerprint VARCHAR(64) NOT NULL AFTER network_used;
ALTER TABLE emergency_messages
ADD CONSTRAINT uq_fingerprint UNIQUE (fingerprint);
CREATE INDEX idx_status
ON emergency_messages(status);
CREATE INDEX idx_created
ON emergency_messages(created_at);
CREATE INDEX idx_phone
ON emergency_messages(phone);
ALTER TABLE processed_incidents
MODIFY message_id INT NOT NULL;
ALTER TABLE processed_incidents
ADD CONSTRAINT uq_processed UNIQUE(message_id);
CREATE INDEX idx_severity
ON processed_incidents(severity);

DESCRIBE emergency_messages;
DESCRIBE processed_incidents;
SHOW INDEX FROM emergency_messages;
SHOW INDEX FROM processed_incidents;
SELECT * FROM emergency_messages;

DELETE FROM emergency_messages 
WHERE id =  2;

ALTER TABLE emergency_messages
ADD COLUMN packet_id VARCHAR(100),
ADD COLUMN hop_count INT DEFAULT 0,
ADD COLUMN relay_device_id VARCHAR(100);

ALTER TABLE emergency_messages
DROP COLUMN packet_id,
DROP COLUMN hop_count,
DROP COLUMN relay_device_id;