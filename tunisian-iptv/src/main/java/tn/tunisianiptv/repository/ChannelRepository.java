
package tn.tunisianiptv.repository;

import tn.tunisianiptv.entity.Channel;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelRepository extends JpaRepository<Channel, Long> {

    boolean existsByStreamUrl(String streamUrl);

    boolean existsByNameIgnoreCaseAndCategory(
            String name,
            String category
    );
}
