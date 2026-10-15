
package tn.tunisianiptv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scrapes arabic-toons.com series pages. Each episode page embeds a
 * signed direct MP4 URL, so episodes play without any YouTube quota.
 */
@Service
public class ToonsService {

    private static final String SITE_BASE = "https://www.arabic-toons.com/";
    private static final String SALLY_SERIES_PATH = "sally-1405893806-20362.html";

    private static final String BROWSER_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    + "AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/126.0 Safari/537.36";

    private static final int SALLY_EPISODES = 46;

    // Signed stream tokens expire: refresh hourly, serve cache in between.
    private static final long CACHE_TTL_MILLIS = 60 * 60 * 1000;

    private static final Pattern EPISODE_LINK = Pattern.compile(
            "<a\\s+href=\"([^\"]*sally-1405893806-\\d+\\.html[^\"]*)\""
                    + "[^>]*title=\"([^\"]*)\"",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern VIDEO_SRC = Pattern.compile(
            "const videoSrc\\s*=\\s*\"([^\"]+)\"");

    private static final Pattern POSTER = Pattern.compile(
            "poster:\\s*'([^']+)'");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10))
            .build();

    @SuppressWarnings("unused")
    private final ObjectMapper objectMapper;

    private volatile List<Map<String, Object>> cachedSally = null;
    private volatile long cachedSallyAt = 0;

    public ToonsService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Value("${toons.sally.path:" + SALLY_SERIES_PATH + "}")
    private String sallySeriesPath;

    public synchronized List<Map<String, Object>> getSallyEpisodes()
            throws Exception {

        long now = System.currentTimeMillis();
        if (cachedSally != null
                && (now - cachedSallyAt) < CACHE_TTL_MILLIS) {
            return cachedSally;
        }

        List<Map<String, Object>> episodes = fetchSallyEpisodes();
        cachedSally = episodes;
        cachedSallyAt = now;
        return episodes;
    }

    private List<Map<String, Object>> fetchSallyEpisodes()
            throws Exception {

        String seriesHtml = getPage(SITE_BASE + sallySeriesPath);

        // episodeNumber -> page path, deduplicated, in site order.
        Map<Integer, String> pages = new TreeMap<>();
        Matcher links = EPISODE_LINK.matcher(seriesHtml);
        while (links.find() && pages.size() < SALLY_EPISODES) {
            String href = links.group(1);
            String title = links.group(2);
            Set<Integer> numbers = YouTubeService.extractNumbers(title);
            if (numbers.size() != 1) {
                continue;
            }
            int episodeNumber = numbers.iterator().next();
            if (episodeNumber < 1
                    || episodeNumber > SALLY_EPISODES
                    || pages.containsKey(episodeNumber)) {
                continue;
            }
            pages.put(episodeNumber, toAbsoluteUrl(href));
        }

        // Fetch episode pages in parallel: 46 sequential page loads is
        // what made cold opens take ~20s. Six workers bring it to seconds.
        ExecutorService pool = Executors.newFixedThreadPool(6);
        try {
            List<Future<Map<String, Object>>> futures = new ArrayList<>();
            for (Map.Entry<Integer, String> page : pages.entrySet()) {
                final int episodeNumber = page.getKey();
                final String pageUrl = page.getValue();
                futures.add(pool.submit(() -> {
                    try {
                        return fetchEpisode(episodeNumber, pageUrl);
                    } catch (Exception error) {
                        Map<String, Object> episode =
                                emptyEpisode(episodeNumber);
                        episode.put("pageUrl", pageUrl);
                        return episode;
                    }
                }));
            }

            Set<Integer> found = new HashSet<>();
            List<Map<String, Object>> episodes = new ArrayList<>();
            for (Future<Map<String, Object>> future : futures) {
                try {
                    Map<String, Object> episode = future.get();
                    episodes.add(episode);
                    found.add((Integer) episode.get("episodeNumber"));
                } catch (ExecutionException failed) {
                    throw new IllegalStateException(
                            "Sally scrape failed.",
                            failed.getCause());
                }
            }

            for (int episodeNumber = 1;
                 episodeNumber <= SALLY_EPISODES;
                 episodeNumber++) {
                if (!found.contains(episodeNumber)) {
                    episodes.add(emptyEpisode(episodeNumber));
                }
            }

            episodes.sort(Comparator.comparingInt(
                    episode -> (Integer) episode.get("episodeNumber")));
            return episodes;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                    "Sally scrape was interrupted.");
        } finally {
            pool.shutdownNow();
        }
    }

    private Map<String, Object> fetchEpisode(
            int episodeNumber, String pageUrl) throws Exception {

        String html = getPage(pageUrl);

        String streamUrl = firstGroup(VIDEO_SRC, html);
        // The site appends a cache-buster at runtime; the base URL is
        // enough for direct <video> playback.
        int cacheBuster = streamUrl.indexOf("\"+");
        if (cacheBuster >= 0) {
            streamUrl = streamUrl.substring(0, cacheBuster);
        }

        String thumbnail = firstGroup(
                Pattern.compile(
                        "<img\\s+src=\"([^\"]+)\"[^>]*alt=\"[^\"]*"
                                + "الحلقة\\s*"
                                + episodeNumber
                                + "\"",
                        Pattern.CASE_INSENSITIVE),
                html);

        Map<String, Object> episode = new HashMap<>();
        episode.put("episodeNumber", episodeNumber);
        episode.put("title", "سالي الحلقة " + episodeNumber);
        episode.put("pageUrl", pageUrl);
        episode.put("streamUrl", streamUrl);
        episode.put("thumbnail", thumbnail);
        episode.put("poster", firstGroup(POSTER, html));
        episode.put("verified", !streamUrl.isEmpty());
        return episode;
    }

    private static Map<String, Object> emptyEpisode(int episodeNumber) {
        Map<String, Object> episode = new HashMap<>();
        episode.put("episodeNumber", episodeNumber);
        episode.put("title", "سالي الحلقة " + episodeNumber);
        episode.put("pageUrl", "");
        episode.put("streamUrl", "");
        episode.put("thumbnail", "");
        episode.put("poster", "");
        episode.put("verified", false);
        return episode;
    }

    private static String firstGroup(Pattern pattern, String html) {
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1) : "";
    }

    private static String toAbsoluteUrl(String href) {
        String clean = href.split("#")[0].trim();
        if (clean.startsWith("http")) {
            return clean;
        }
        return SITE_BASE + clean.replaceFirst("^/+", "");
    }

    private String getPage(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", BROWSER_UA)
                .timeout(java.time.Duration.ofSeconds(20))
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );

        if (response.statusCode() != 200) {
            throw new IllegalStateException(
                    "arabic-toons.com returned HTTP "
                            + response.statusCode()
                            + " for " + url);
        }

        return response.body();
    }
}
