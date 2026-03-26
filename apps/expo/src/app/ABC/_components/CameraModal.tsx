import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import type { CameraType} from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface CameraModalProps {
  visible: boolean;
  onPhotoConfirm: (photoUri: string) => void;
  onCancel: () => void;
}

const { width, height } = Dimensions.get('window');

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onPhotoConfirm,
  onCancel,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible, permission]);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo?.uri) {
          setCapturedPhoto(photo.uri);
          setShowPreview(true);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const flipCamera = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setShowPreview(false);
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onPhotoConfirm(capturedPhoto);
      setCapturedPhoto(null);
      setShowPreview(false);
    }
  };

  const handleCancel = () => {
    setCapturedPhoto(null);
    setShowPreview(false);
    onCancel();
  };

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text>Requesting camera permission...</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>No access to camera</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleCancel}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {showPreview ? (
        // Photo Preview Screen
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Doctor photo</Text>
          
          <View style={styles.photoContainer}>
            {capturedPhoto && (
              <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
            )}
          </View>
          
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
            <MaterialCommunityIcons name="camera-retake-outline" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}
            className='p-5'
            >
        <Feather name="check" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Camera Screen
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={cameraType}
          >
            {/* Camera Header */}
            <View style={styles.cameraHeader}>
              <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
                <Text style={styles.headerButtonText}>✕</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.headerButton} onPress={flipCamera}>
              <MaterialCommunityIcons name="camera-flip-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Camera Controls */}
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  permissionText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  flipIcon: {
    color: '#fff',
    fontSize: 16,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: {
    position: 'absolute',
    top: 80,
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  photoContainer: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 50,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 50,
    position: 'absolute',
    bottom: 100,
  },
  retakeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  confirmButton: {
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  confirmIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
