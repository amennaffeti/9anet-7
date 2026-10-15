
package tn.tunisianiptv.service;

import tn.tunisianiptv.entity.Channel;
import tn.tunisianiptv.repository.ChannelRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Ensures curated TV channels exist. Runs on every boot but only
 * inserts missing rows, so restarts never duplicate data.
 */
@Component
public class ChannelSeeder implements CommandLineRunner {

    private final ChannelRepository channelRepository;

    public ChannelSeeder(ChannelRepository channelRepository) {
        this.channelRepository = channelRepository;
    }

    @Override
    public void run(String... args) {
        ensureChannel(
                "Al Jazeera",
                "Tunisian TV",
                "Al Jazeera Arabic live news",
                "https://live-hls-web-aja.getaj.net/AJA/index.m3u8",
                "https://www.aljazeera.net/video/live");
    }

    private void ensureChannel(
            String name,
            String category,
            String description,
            String streamUrl,
            String sourcePageUrl) {

        if (channelRepository.existsByNameIgnoreCaseAndCategory(
                name, category)) {
            return;
        }

        // Self-migration: a previous boot may have seeded this channel
        // under a different category (e.g. "News"). Move it instead of
        // inserting a duplicate row.
        channelRepository.findFirstByNameIgnoreCase(name).ifPresentOrElse(
                existing -> {
                    existing.setCategory(category);
                    existing.setStreamUrl(streamUrl);
                    existing.setSourcePageUrl(sourcePageUrl);
                    if (existing.getDescription() == null) {
                        existing.setDescription(description);
                    }
                    existing.setActive(true);
                    channelRepository.save(existing);
                },
                () -> {
                    Channel channel = new Channel();
                    channel.setName(name);
                    channel.setCategory(category);
                    channel.setDescription(description);
                    channel.setStreamUrl(streamUrl);
                    channel.setSourcePageUrl(sourcePageUrl);
                    channel.setActive(true);
                    channelRepository.save(channel);
                });
    }
}
