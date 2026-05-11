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
            # We return a unique integer ID and the raw template data.
            finger_id = random.randint(1, 1000)
            # Simulated base64 template string
            template = "SIMULATED_FINGERPRINT_TEMPLATE_DATA_" + str(finger_id)
            return {
                "success": True, 
                "fingerprint_id": finger_id, 
                "template": template,
                "message": "Fingerprint enrolled and template captured (Simulated)"
            }
        
        # Real hardware logic would go here
        return {"success": False, "message": "Hardware not connected"}

    def verify(self, target_id=None):
        """
        Simulates waiting for a finger and matching it.
        """
        if not self.use_hardware:
            time.sleep(1.5)
            # In simulation, if a target_id is provided, we succeed for that ID.
            # Otherwise, we return a default successful ID for demo purposes.
            demo_id = target_id if target_id else 1
            return {
                "success": True, 
                "fingerprint_id": demo_id, 
                "message": "Fingerprint matched (Simulated)"
            }
        
        return {"success": False, "message": "Hardware sensor not responding"}

# Singleton instance
fingerprint_service = FingerprintService(use_hardware=False)
