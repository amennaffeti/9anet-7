
package tn.tunisianiptv.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "channels")
public class Channel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    private String description;

    private String logoUrl;

    // Most recently resolved video stream URL
    @Column(length = 2048)
    private String streamUrl;

    // Stable page or API used to discover the stream
    @Column(length = 2048)
    private String sourcePageUrl;

    // Optional alternative stream
    @Column(length = 2048)
    private String backupStreamUrl;

    // Whether the channel is enabled in Qanat 7
    private boolean active = true;

    // Stream health information
    private String streamStatus = "UNKNOWN";

    private LocalDateTime lastCheckedAt;

    @Column(length = 1000)
    private String lastStreamError;

    public Channel() {
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getStreamUrl() {
        return streamUrl;
    }

    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }

    public String getSourcePageUrl() {
        return sourcePageUrl;
    }

    public void setSourcePageUrl(String sourcePageUrl) {
        this.sourcePageUrl = sourcePageUrl;
    }

    public String getBackupStreamUrl() {
        return backupStreamUrl;
    }

    public void setBackupStreamUrl(String backupStreamUrl) {
        this.backupStreamUrl = backupStreamUrl;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getStreamStatus() {
        return streamStatus;
    }

    public void setStreamStatus(String streamStatus) {
        this.streamStatus = streamStatus;
    }

    public LocalDateTime getLastCheckedAt() {
        return lastCheckedAt;
    }

    public void setLastCheckedAt(LocalDateTime lastCheckedAt) {
        this.lastCheckedAt = lastCheckedAt;
    }

    public String getLastStreamError() {
        return lastStreamError;
    }

    public void setLastStreamError(String lastStreamError) {
        this.lastStreamError = lastStreamError;
    }
}
