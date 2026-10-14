
package tn.tunisianiptv.controller;

import tn.tunisianiptv.service.YouTubeService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cartoons")
@CrossOrigin(origins = {
        "http://localhost:4200",
        "http://127.0.0.1:4200"
})
public class YouTubeController {

    private final YouTubeService youTubeService;

    public YouTubeController(YouTubeService youTubeService) {
        this.youTubeService = youTubeService;
    }

    @GetMapping("/spongebob")
    public List<Map<String, String>> getSpongeBobVideos()
            throws Exception {
        return youTubeService.getSpongeBobVideos();
    }

    @GetMapping("/sally")
    public List<Map<String, Object>> getSallyEpisodes()
            throws Exception {
        return youTubeService.discoverSallyEpisodes();
    }

    @GetMapping("/sally/discover")
    public List<Map<String, Object>> discoverSallyEpisodes()
            throws Exception {
        return youTubeService.discoverSallyEpisodes();
    }

}
