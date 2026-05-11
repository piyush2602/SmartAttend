import time
import random

class FingerprintService:
    def __init__(self, use_hardware=False):
        self.use_hardware = use_hardware
        # In a real scenario, you'd initialize the sensor here
        # self.sensor = PyFingerprint('/dev/ttyUSB0', 57600, 0xFFFFFFFF, 0x00000000)
        pass

    def enroll(self, user_id):
        """
        Simulates the enrollment process: 
        1. Wait for finger
        2. Capture
        3. Wait for finger again
        4. Capture
        5. Store
        """
        if not self.use_hardware:
            # Simulate steps for UI feedback
            time.sleep(1)
            # In a real app, you might want to yield progress, 
            # but for simplicity we'll just simulate a successful store.
            # We return a unique integer ID that the sensor uses.
            finger_id = random.randint(1, 1000)
            return {"success": True, "fingerprint_id": finger_id, "message": "Fingerprint enrolled successfully (Simulated)"}
        
        # Real hardware logic would go here
        return {"success": False, "message": "Hardware not connected"}

    def verify(self):
        """
        Simulates waiting for a finger and matching it.
        """
        if not self.use_hardware:
            time.sleep(2)
            # In simulation, we don't know who it is unless we mock it.
            # For demonstration, we'll return a 'not found' or a specific ID if we had one.
            return {"success": False, "message": "No match found (Simulated)"}
        
        return {"success": False, "message": "Hardware not connected"}

# Singleton instance
fingerprint_service = FingerprintService(use_hardware=False)
