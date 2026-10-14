
package tn.tunisianiptv.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.tunisianiptv.service.RadioImportService;

import java.util.Map;

@RestController
@RequestMapping("/api/channels")
public class RadioImportController {

    private final RadioImportService radioImportService;

    public RadioImportController(
            RadioImportService radioImportService) {
        this.radioImportService = radioImportService;
    }

    @PostMapping("/import-radios")
    public ResponseEntity<?> importRadios() {
        try {
            return ResponseEntity.ok(
                    radioImportService.importRadios()
            );
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of(
                            "error", "Radio import failed",
                            "message", e.getMessage() == null
                                    ? "Unknown error"
                                    : e.getMessage()
                    ));
        }
    }
}
