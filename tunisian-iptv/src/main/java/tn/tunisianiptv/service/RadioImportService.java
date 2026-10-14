
package tn.tunisianiptv.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import tn.tunisianiptv.entity.Channel;
import tn.tunisianiptv.repository.ChannelRepository;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class RadioImportService {

    private static final String API_URL =
            "https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/TN?hidebroken=true&limit=1000&order=votes&reverse=true";

    private final ChannelRepository channelRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public RadioImportService(
            ChannelRepository channelRepository,
            ObjectMapper objectMapper) {

        this.channelRepository = channelRepository;
        this.objectMapper = objectMapper;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public Map<String, Object> importRadios()
            throws Exception {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .timeout(Duration.ofSeconds(45))
                .header("User-Agent", "Qanat7-IPTV/1.0")
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "Radio Browser returned HTTP "
                            + response.statusCode()
            );
        }

        JsonNode stations = objectMapper.readTree(
                response.body()
        );

        if (!stations.isArray()) {
            throw new IllegalStateException(
                    "Unexpected response from Radio Browser."
            );
        }

        int imported = 0;
        int skipped = 0;

        for (JsonNode station : stations) {

            String name = station.path("name").asText("").trim();
            String streamUrl = station.path("url").asText("").trim();

            if (name.isBlank() || streamUrl.isBlank()) {
                skipped++;
                continue;
            }

            if (channelRepository.existsByStreamUrl(streamUrl)
                    || channelRepository
                    .existsByNameIgnoreCaseAndCategory(
                            name, "Radios")) {
                skipped++;
                continue;
            }

            Channel channel = new Channel();

            channel.setName(name);
            channel.setCategory("Radios");
            channel.setDescription("Tunisian radio station");
            channel.setStreamUrl(streamUrl);
            channel.setSourcePageUrl(
                    station.path("homepage").asText("")
            );
            channel.setLogoUrl(
                    station.path("favicon").asText("")
            );
            channel.setActive(true);
            channel.setStreamStatus("UNKNOWN");

            channelRepository.save(channel);
            imported++;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("source", "Radio Browser");
        result.put("stationsFound", stations.size());
        result.put("imported", imported);
        result.put("skipped", skipped);

        return result;
    }
}
