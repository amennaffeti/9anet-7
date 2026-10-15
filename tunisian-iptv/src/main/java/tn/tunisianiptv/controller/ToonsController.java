
package tn.tunisianiptv.controller;

import tn.tunisianiptv.service.ToonsService;
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
public class ToonsController {

    private final ToonsService toonsService;

    public ToonsController(ToonsService toonsService) {
        this.toonsService = toonsService;
    }

    @GetMapping("/sally/toons")
    public List<Map<String, Object>> getSallyEpisodes()
            throws Exception {
        return toonsService.getSallyEpisodes();
    }
}
