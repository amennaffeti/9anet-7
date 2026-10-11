
package tn.tunisianiptv.controller;

import tn.tunisianiptv.entity.Channel;
import tn.tunisianiptv.repository.ChannelRepository;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/channels")
@CrossOrigin(origins = "http://localhost:4200")
public class ChannelController {

    private final ChannelRepository channelRepository;

    public ChannelController(ChannelRepository channelRepository) {
        this.channelRepository = channelRepository;
    }

    @GetMapping
    public List<Channel> getAllChannels() {
        return channelRepository.findAll();
    }
}
