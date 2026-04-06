import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AudioMessage {
  id: string;
  audioUrl: string;
  senderName: string;
  senderId: string;
  timestamp: number;
}

export const useWalkieTalkie = (channelName: string = 'office-walkie-talkie') => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastMessage, setLastMessage] = useState<AudioMessage | null>(null);
  const [deviceName, setDeviceName] = useState(() => {
    return localStorage.getItem('walkie_talkie_device_name') || `Device-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const channelRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const deviceIdRef = useRef(localStorage.getItem('walkie_talkie_device_id') || crypto.randomUUID());
  const { toast } = useToast();

  // Unlock audio playback on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      // Play a silent buffer to unlock audio
      const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  // Persist device ID
  useEffect(() => {
    localStorage.setItem('walkie_talkie_device_id', deviceIdRef.current);
  }, []);

  const setAndSaveDeviceName = useCallback((name: string) => {
    setDeviceName(name);
    localStorage.setItem('walkie_talkie_device_name', name);
  }, []);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'audio_message' }, (payload) => {
        const msg = payload.payload as AudioMessage;
        setLastMessage(msg);
        // Auto-play received audio
        playAudio(msg.audioUrl);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName]);

  const playAudio = useCallback(async (url: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      const audio = new Audio(url);
      audio.preload = 'auto';
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = (e) => {
        console.error('[WalkieTalkie] Playback error:', e);
        setIsPlaying(false);
      };
      // Wait for audio to be ready before playing
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error('Failed to load audio'));
        setTimeout(() => resolve(), 3000); // fallback timeout
      });
      await audio.play();
      console.log('[WalkieTalkie] Playing audio from broadcast');
    } catch (err) {
      console.error('[WalkieTalkie] Play failed:', err);
      setIsPlaying(false);
      toast({ title: 'Audio', description: 'Received message but could not play audio', variant: 'destructive' });
    }
  }, [toast]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 1000) return; // Skip tiny recordings (accidental taps)

        const ext = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
        const fileName = `${Date.now()}-${deviceIdRef.current.slice(0, 8)}.${ext}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('walkie-talkie')
          .upload(fileName, blob, {
            contentType: mediaRecorder.mimeType,
            cacheControl: '3600',
          });

        if (error) {
          console.error('Upload error:', error);
          toast({ title: 'Error', description: 'Failed to send audio', variant: 'destructive' });
          return;
        }

        // Use signed URL for reliable access
        const { data: signedData, error: signError } = await supabase.storage
          .from('walkie-talkie')
          .createSignedUrl(fileName, 300); // 5 min expiry

        if (signError || !signedData?.signedUrl) {
          console.error('Signed URL error:', signError);
          toast({ title: 'Error', description: 'Failed to generate audio URL', variant: 'destructive' });
          return;
        }

        const message: AudioMessage = {
          id: crypto.randomUUID(),
          audioUrl: signedData.signedUrl,
          senderName: deviceName,
          senderId: deviceIdRef.current,
          timestamp: Date.now(),
        };

        // Broadcast to all devices
        channelRef.current?.send({
          type: 'broadcast',
          event: 'audio_message',
          payload: message,
        });

        // Also play locally so sender hears confirmation
        console.log('[WalkieTalkie] Audio sent successfully:', fileName);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // collect data every 100ms
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast({
        title: 'Microphone Access Required',
        description: 'Please allow microphone access to use walkie-talkie',
        variant: 'destructive',
      });
    }
  }, [deviceName, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    isPlaying,
    lastMessage,
    deviceName,
    setDeviceName: setAndSaveDeviceName,
    startRecording,
    stopRecording,
  };
};
