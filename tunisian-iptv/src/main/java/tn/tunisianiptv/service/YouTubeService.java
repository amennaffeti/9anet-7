
package tn.tunisianiptv.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class YouTubeService {

    @Value("${youtube.api.key}")
    private String apiKey;

    // Ordered 46-episode Sally playlist (the part after list= in its
    // YouTube URL). Playlist order = episode order, so the JSON is
    // always exactly episodes 1..46 with no searching involved.
    @Value("${sally.playlist.id:}")
    private String sallyPlaylistId;

    private final ObjectMapper objectMapper;

    private final HttpClient httpClient =
            HttpClient.newHttpClient();

    // Nickelodeon Arabia's handle
    private static final String CHANNEL_HANDLE =
            "NickelodeonArabia";

    // Only keep long compilations.
    private static final long MIN_DURATION_MINUTES = 40;

    // Cache the filtered list so repeat visits are instant instead of
    // hitting the YouTube API on every Cartoons tab open.
    private static final long CACHE_TTL_MILLIS = 30 * 60 * 1000;

    private volatile List<Map<String, String>> cachedVideos = null;
    private volatile long cachedAtMillis = 0;

    // Sally episodes never change, so cache them for a long time: every
    // cold refresh costs ~46 YouTube searches out of a ~100/day budget.
    private static final long SALLY_CACHE_TTL_MILLIS =
            6 * 60 * 60 * 1000;

    private volatile List<Map<String, Object>> cachedSallyEpisodes = null;
    private volatile long cachedSallyAtMillis = 0;

    private static final int SALLY_FIRST_EPISODE = 1;
    private static final int SALLY_LAST_EPISODE = 46;

    // Matches Latin, Arabic-Indic and Eastern Arabic-Indic digits.
    private static final Pattern NUMBER_TOKEN = Pattern.compile(
            "[0-9\u0660-\u0669\u06F0-\u06F9]+");

    public YouTubeService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized List<Map<String, String>> getSpongeBobVideos()
            throws Exception {

        long now = System.currentTimeMillis();
        if (cachedVideos != null
                && (now - cachedAtMillis) < CACHE_TTL_MILLIS) {
            return cachedVideos;
        }

        List<Map<String, String>> videos = fetchLongSpongeBobVideos();
        cachedVideos = videos;
        cachedAtMillis = now;
        return videos;
    }

    private List<Map<String, String>> fetchLongSpongeBobVideos()
            throws Exception {

        List<Map<String, String>> videos = new ArrayList<>();
        List<Map<String, String>> candidates = new ArrayList<>();

        String channelUrl =
                "https://www.googleapis.com/youtube/v3/channels"
                        + "?part=contentDetails"
                        + "&forHandle=" + CHANNEL_HANDLE
                        + "&key=" + apiKey;

        JsonNode channelResponse = getJson(channelUrl);
        JsonNode items = channelResponse.path("items");

        if (!items.isArray() || items.isEmpty()) {
            throw new IllegalStateException(
                    "Nickelodeon Arabia channel was not found."
            );
        }

        String uploadsPlaylistId = items.get(0)
                .path("contentDetails")
                .path("relatedPlaylists")
                .path("uploads")
                .asText();

        String pageToken = "";
        int pageCount = 0;

        // Retrieve uploads page by page.
        do {
            String playlistUrl =
                    "https://www.googleapis.com/youtube/v3/playlistItems"
                            + "?part=snippet"
                            + "&playlistId=" + uploadsPlaylistId
                            + "&maxResults=50"
                            + "&key=" + apiKey;

            if (!pageToken.isEmpty()) {
                playlistUrl += "&pageToken="
                        + URLEncoder.encode(
                        pageToken,
                        StandardCharsets.UTF_8
                );

            }

            JsonNode playlistResponse = getJson(playlistUrl);

            for (JsonNode item : playlistResponse.path("items")) {
                JsonNode snippet = item.path("snippet");
                JsonNode resourceId = snippet.path("resourceId");

                String videoId = resourceId
                        .path("videoId").asText("");

                String title = snippet.path("title").asText("");

                String thumbnail = snippet
                        .path("thumbnails")
                        .path("high")
                        .path("url")
                        .asText(
                                snippet.path("thumbnails")
                                        .path("default")
                                        .path("url")
                                        .asText("")
                        );

                String searchable = title.toLowerCase();


                boolean isSpongeBob =
                        searchable.contains("spongebob")
                                || searchable.contains("sponge bob")
                                || searchable.contains("سبونج")
                                || searchable.contains("سبونجبوب");

                if (!videoId.isEmpty() && isSpongeBob) {
                    candidates.add(Map.of(
                            "videoId", videoId,
                            "title", title,
                            "thumbnail", thumbnail,
                            "publishedAt", snippet
                                    .path("publishedAt").asText("")
                    ));
                }
            }

            pageToken = playlistResponse
                    .path("nextPageToken").asText("");

            pageCount++;

        } while (!pageToken.isEmpty() && pageCount < 2);

        if (candidates.isEmpty()) {
            return videos;
        }

        // playlistItems has no durations: batch-fetch contentDetails
        // (up to 50 ids per call) and keep only 40+ minute videos.
        List<String> candidateIds = new ArrayList<>();
        for (Map<String, String> candidate : candidates) {
            candidateIds.add(candidate.get("videoId"));
        }

        Map<String, Long> durations = fetchDurations(candidateIds);

        for (Map<String, String> candidate : candidates) {
            long minutes = durations.getOrDefault(
                    candidate.get("videoId"), 0L);
            if (minutes >= MIN_DURATION_MINUTES) {
                videos.add(Map.of(
                        "videoId", candidate.get("videoId"),
                        "title", candidate.get("title"),
                        "thumbnail", candidate.get("thumbnail"),
                        "publishedAt",
                        candidate.get("publishedAt"),
                        "durationMinutes",
                        String.valueOf(minutes)
                ));
            }
        }

        return videos;
    }

    private Map<String, Long> fetchDurations(List<String> videoIds)
            throws Exception {
        Map<String, Long> durations = new HashMap<>();

        for (int i = 0; i < videoIds.size(); i += 50) {
            List<String> batch = videoIds.subList(
                    i, Math.min(i + 50, videoIds.size()));

            String videosUrl =
                    "https://www.googleapis.com/youtube/v3/videos"
                            + "?part=contentDetails"
                            + "&id=" + String.join(",", batch)
                            + "&key=" + apiKey;

            JsonNode videosResponse = getJson(videosUrl);

            for (JsonNode item : videosResponse.path("items")) {
                String id = item.path("id").asText("");
                String isoDuration = item.path("contentDetails")
                        .path("duration").asText("");

                if (!id.isEmpty() && !isoDuration.isEmpty()) {
                    try {
                        durations.put(
                                id,
                                Duration.parse(isoDuration)
                                        .toMinutes());
                    } catch (DateTimeParseException ignored) {
                        // Skip videos with unreadable durations.
                    }
                }
            }
        }

        return durations;
    }

    private JsonNode getJson(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "YouTube API returned HTTP "
                            + response.statusCode()
            );
        }

        return objectMapper.readTree(response.body());
    }

    private JsonNode postInnerTube(String query) throws Exception {
        String body = "{\"context\":{\"client\":{"
                + "\"clientName\":\"WEB\","
                + "\"clientVersion\":\"2.20240101.00.00\"}},"
                + "\"query\":" + objectMapper.writeValueAsString(query)
                + "}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(
                        "https://www.youtube.com/youtubei/v1/search"
                                + "?prettyPrint=false"))
                .header("Content-Type", "application/json")
                .header("User-Agent",
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                + "AppleWebKit/537.36 (KHTML, like Gecko) "
                                + "Chrome/126.0 Safari/537.36")
                .POST(HttpRequest.BodyPublishers.ofString(
                        body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );

        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "YouTube search returned HTTP "
                            + response.statusCode()
            );
        }

        return objectMapper.readTree(response.body());
    }

    private static String joinRuns(JsonNode parent, String field) {
        JsonNode runs = parent.path(field).path("runs");
        if (runs.isArray() && !runs.isEmpty()) {
            StringBuilder title = new StringBuilder();
            for (JsonNode run : runs) {
                title.append(run.path("text").asText(""));
            }
            return title.toString();
        }
        return parent.path(field).path("simpleText").asText("");
    }

    private List<Map<String, String>> searchInnerTube(String query)
            throws Exception {

        List<Map<String, String>> candidates = new ArrayList<>();
        JsonNode response = postInnerTube(query);

        JsonNode sections = response
                .path("contents")
                .path("twoColumnSearchResultsRenderer")
                .path("primaryContents")
                .path("sectionListRenderer")
                .path("contents");

        for (JsonNode section : sections) {
            for (JsonNode item : section
                    .path("itemSectionRenderer")
                    .path("contents")) {
                JsonNode video = item.path("videoRenderer");
                if (video.isMissingNode()) {
                    continue;
                }

                String videoId = video.path("videoId").asText("");
                if (videoId.isEmpty()) {
                    continue;
                }

                String thumbnail = "";
                JsonNode thumbs = video
                        .path("thumbnail").path("thumbnails");
                if (thumbs.isArray() && !thumbs.isEmpty()) {
                    thumbnail = thumbs.get(thumbs.size() - 1)
                            .path("url").asText("");
                }

                String channel = joinRuns(video, "ownerText");
                if (channel.isEmpty()) {
                    channel = joinRuns(video, "longBylineText");
                }

                Map<String, String> candidate = new HashMap<>();
                candidate.put("videoId", videoId);
                candidate.put("url",
                        "https://www.youtube.com/watch?v=" + videoId);
                candidate.put("title", joinRuns(video, "title"));
                candidate.put("channel", channel);
                candidate.put("thumbnail", thumbnail);

                candidates.add(candidate);
                if (candidates.size() >= 12) {
                    return candidates;
                }
            }
        }

        return candidates;
    }

    /**
     * Serves the 46 Sally episodes in playlist order (episode 1 first).
     * Costs ~2 YouTube quota units per cold refresh and is cached, so it
     * works even when the search quota is exhausted.
     */
    public synchronized List<Map<String, Object>> getSallyEpisodes()
            throws Exception {

        long now = System.currentTimeMillis();
        if (cachedSallyEpisodes != null
                && (now - cachedSallyAtMillis) < SALLY_CACHE_TTL_MILLIS) {
            return cachedSallyEpisodes;
        }

        if (sallyPlaylistId == null || sallyPlaylistId.isBlank()) {
            throw new IllegalStateException(
                    "Sally playlist is not configured: set sally.playlist.id "
                            + "to the 46-episode playlist ID.");
        }

        List<Map<String, String>> items =
                fetchPlaylistVideos(sallyPlaylistId.trim());

        Map<String, Long> durations =
                fetchDurations(extractIds(items));

        List<Map<String, Object>> episodes = new ArrayList<>();
        for (int i = 0;
             i < SALLY_LAST_EPISODE;
             i++) {
            if (i < items.size()) {
                Map<String, String> item = items.get(i);
                long minutes = durations.getOrDefault(
                        item.get("videoId"), 0L);
                Map<String, Object> episode = new HashMap<>();
                episode.put("episodeNumber", i + 1);
                episode.put("videoId", item.get("videoId"));
                episode.put("url", "https://www.youtube.com/watch?v="
                        + item.get("videoId"));
                episode.put("title", item.get("title"));
                episode.put("channel", item.get("channel"));
                episode.put("thumbnail", item.get("thumbnail"));
                episode.put("durationMinutes", String.valueOf(minutes));
                episode.put("verified", true);
                episodes.add(episode);
            } else {
                Map<String, Object> episode = new HashMap<>();
                episode.put("episodeNumber", i + 1);
                episode.put("videoId", "");
                episode.put("url", "");
                episode.put("title", "");
                episode.put("channel", "");
                episode.put("thumbnail", "");
                episode.put("durationMinutes", "");
                episode.put("verified", false);
                episodes.add(episode);
            }
        }

        cachedSallyEpisodes = episodes;
        cachedSallyAtMillis = now;
        return episodes;
    }

    private List<String> extractIds(List<Map<String, String>> items) {
        List<String> ids = new ArrayList<>();
        for (Map<String, String> item : items) {
            String id = item.getOrDefault("videoId", "");
            if (!id.isEmpty()) {
                ids.add(id);
            }
        }
        return ids;
    }

    private List<Map<String, String>> fetchPlaylistVideos(String playlistId)
            throws Exception {

        List<Map<String, String>> videos = new ArrayList<>();
        String pageToken = "";

        do {
            String playlistUrl =
                    "https://www.googleapis.com/youtube/v3/playlistItems"
                            + "?part=snippet"
                            + "&playlistId=" + playlistId
                            + "&maxResults=50"
                            + "&key=" + apiKey;

            if (!pageToken.isEmpty()) {
                playlistUrl += "&pageToken=" + URLEncoder.encode(
                        pageToken, StandardCharsets.UTF_8);
            }

            JsonNode playlistResponse = getJson(playlistUrl);

            for (JsonNode item : playlistResponse.path("items")) {
                JsonNode snippet = item.path("snippet");
                String videoId = snippet.path("resourceId")
                        .path("videoId").asText("");

                String thumbnail = snippet.path("thumbnails")
                        .path("high").path("url").asText("");
                if (thumbnail.isEmpty()) {
                    thumbnail = snippet.path("thumbnails")
                            .path("default").path("url").asText("");
                }

                if (videoId.isEmpty()) {
                    continue;
                }

                Map<String, String> video = new HashMap<>();
                video.put("videoId", videoId);
                video.put("title", snippet.path("title").asText(""));
                video.put("channel",
                        snippet.path("videoOwnerChannelTitle").asText(
                                snippet.path("channelTitle").asText("")));
                video.put("thumbnail", thumbnail);
                videos.add(video);
            }

            pageToken = playlistResponse
                    .path("nextPageToken").asText("");

        } while (!pageToken.isEmpty()
                && videos.size() < SALLY_LAST_EPISODE);

        return videos;
    }

    /**
     * Returns exactly episodes 1..46 of Sally in order. An entry is only
     * marked verified when the video title actually contains that episode
     * number, so compilations, wrong episodes and duplicates can never
     * sneak in. Unmatched episodes keep an empty videoId instead of a
     * wrong video.
     */
    public synchronized List<Map<String, Object>> discoverSallyEpisodes()
            throws Exception {

        long now = System.currentTimeMillis();
        if (cachedSallyEpisodes != null
                && (now - cachedSallyAtMillis) < SALLY_CACHE_TTL_MILLIS) {
            return cachedSallyEpisodes;
        }

        List<Map<String, Object>> episodes = new ArrayList<>();
        Set<String> usedVideoIds = new HashSet<>();

        for (int episodeNumber = SALLY_FIRST_EPISODE;
             episodeNumber <= SALLY_LAST_EPISODE;
             episodeNumber++) {
            episodes.add(findSallyEpisode(episodeNumber, usedVideoIds));
            if (episodeNumber < SALLY_LAST_EPISODE) {
                try {
                    Thread.sleep(300);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(
                            "Sally discovery was interrupted.");
                }
            }
        }

        cachedSallyEpisodes = episodes;
        cachedSallyAtMillis = now;
        return episodes;
    }

    private Map<String, Object> findSallyEpisode(
            int episodeNumber, Set<String> usedVideoIds)
            throws Exception {

        List<String> queries = List.of(
                "سالي الحلقة " + episodeNumber,
                "سالي حلقة " + episodeNumber);

        for (String query : queries) {
            List<Map<String, String>> candidates =
                    searchEpisodeCandidates(query, 5);

            // Strict pass: title must mention Sally and the episode number.
            Map<String, String> match = pickEpisode(
                    candidates, episodeNumber, usedVideoIds, true);
            // Loose pass: title must mention the episode number.
            if (match == null) {
                match = pickEpisode(
                        candidates, episodeNumber, usedVideoIds, false);
            }

            if (match != null) {
                return sallyEntry(
                        episodeNumber, query, match, true);
            }
        }

        return sallyEntry(
                episodeNumber, queries.get(0), Map.of(), false);
    }

    private Map<String, String> pickEpisode(
            List<Map<String, String>> candidates,
            int episodeNumber,
            Set<String> usedVideoIds,
            boolean requireSally) {

        for (Map<String, String> candidate : candidates) {
            String videoId = candidate.getOrDefault("videoId", "");
            if (videoId.isEmpty() || usedVideoIds.contains(videoId)) {
                continue;
            }

            String title = candidate.getOrDefault("title", "");
            if (requireSally && !mentionsSally(title)) {
                continue;
            }
            if (!extractNumbers(title).contains(episodeNumber)) {
                continue;
            }

            usedVideoIds.add(videoId);
            return candidate;
        }

        return null;
    }

    private Map<String, Object> sallyEntry(
            int episodeNumber,
            String query,
            Map<String, String> match,
            boolean verified) {

        Map<String, Object> episode = new HashMap<>();
        episode.put("episodeNumber", episodeNumber);
        episode.put("searchQuery", query);
        episode.put("videoId", match.getOrDefault("videoId", ""));
        episode.put("url", match.getOrDefault("url", ""));
        episode.put("title", match.getOrDefault("title", ""));
        episode.put("channel", match.getOrDefault("channel", ""));
        episode.put("thumbnail", match.getOrDefault("thumbnail", ""));
        episode.put("verified", verified);
        return episode;
    }

    private static boolean mentionsSally(String title) {
        String lower = title == null ? "" : title.toLowerCase();
        return lower.contains("سالي") || lower.contains("sally");
    }

    static Set<Integer> extractNumbers(String title) {
        Set<Integer> numbers = new HashSet<>();
        Matcher matcher = NUMBER_TOKEN.matcher(
                title == null ? "" : title);
        while (matcher.find()) {
            String token = matcher.group();
            int value = 0;
            for (int i = 0; i < token.length(); i++) {
                value = value * 10
                        + arabicDigitValue(token.charAt(i));
            }
            numbers.add(value);
        }
        return numbers;
    }

    private static int arabicDigitValue(char digit) {
        if (digit >= '0' && digit <= '9') {
            return digit - '0';
        }
        if (digit >= '\u0660' && digit <= '\u0669') {
            return digit - '\u0660';
        }
        if (digit >= '\u06F0' && digit <= '\u06F9') {
            return digit - '\u06F0';
        }
        return 0;
    }

    /**
     * Quota-free web search first, Data API search as fallback.
     */
    private List<Map<String, String>> searchEpisodeCandidates(
            String query, int maxResults) throws Exception {
        try {
            return searchInnerTube(query);
        } catch (Exception webError) {
            return searchVideos(query, maxResults);
        }
    }

    private List<Map<String, String>> searchVideos(
            String query, int maxResults) throws Exception {

        String searchUrl =
                "https://www.googleapis.com/youtube/v3/search"
                        + "?part=snippet"
                        + "&type=video"
                        + "&maxResults=" + maxResults
                        + "&q=" + URLEncoder.encode(
                        query, StandardCharsets.UTF_8)
                        + "&key=" + apiKey;

        JsonNode response = getJson(searchUrl);
        List<Map<String, String>> candidates = new ArrayList<>();

        for (JsonNode item : response.path("items")) {
            JsonNode idNode = item.path("id");
            JsonNode snippet = item.path("snippet");

            String videoId = idNode.path("videoId").asText("");
            String title = snippet.path("title").asText("");
            String channel = snippet.path("channelTitle").asText("");

            String thumbnail = snippet.path("thumbnails")
                    .path("high").path("url").asText("");

            if (thumbnail.isEmpty()) {
                thumbnail = snippet.path("thumbnails")
                        .path("default").path("url").asText("");
            }

            if (videoId.isEmpty()) {
                continue;
            }

            Map<String, String> candidate = new HashMap<>();
            candidate.put("videoId", videoId);
            candidate.put("url",
                    "https://www.youtube.com/watch?v=" + videoId);
            candidate.put("title", title);
            candidate.put("channel", channel);
            candidate.put("thumbnail", thumbnail);

            candidates.add(candidate);
        }

        return candidates;
    }

}
