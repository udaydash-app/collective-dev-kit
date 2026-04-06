import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioMessage {
  id: string;
  audioPath?: string;
  audioUrl?: string;
  mimeType?: string;
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
  const objectUrlRef = useRef<string | null>(null);
  const deviceIdRef = useRef(localStorage.getItem('walkie_talkie_device_id') || crypto.randomUUID());
  const { toast } = useToast();

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Unlock audio playback on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      clearObjectUrl();
    };
  }, [clearObjectUrl]);

  const setAndSaveDeviceName = useCallback((name: string) => {
    setDeviceName(name);
    localStorage.setItem('walkie_talkie_device_name', name);
  }, []);

  const resolveAudioSource = useCallback(async (message: AudioMessage) => {
    if (message.audioPath) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase.storage
          .from('walkie-talkie')
          .download(message.audioPath);

        if (data && data.size > 0) {
          clearObjectUrl();
          const objectUrl = URL.createObjectURL(data);
          objectUrlRef.current = objectUrl;
          return objectUrl;
        }

        lastError = new Error(error?.message || 'Failed to download audio');
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
      }

      throw lastError ?? new Error('Failed to download audio');
    }

    if (message.audioUrl) {
      return message.audioUrl;
    }

    throw new Error('Missing audio source');
  }, [clearObjectUrl]);

  const playAudio = useCallback(async (message: AudioMessage) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      clearObjectUrl();

      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const sourceUrl = await resolveAudioSource(message);
      const audio = new Audio();
      audio.src = sourceUrl;
      audio.preload = 'auto';
      audioRef.current = audio;
      setIsPlaying(true);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
        }, 5000);

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          audio.onloadeddata = null;
          audio.oncanplaythrough = null;
          audio.onerror = null;
        };

        const handleReady = () => {
          if (!settled) {
            settled = true;
            cleanup();
            resolve();
          }
        };

        const handleError = () => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(new Error('Failed to load audio'));
          }
        };

        audio.onloadeddata = handleReady;
        audio.oncanplaythrough = handleReady;
        audio.onerror = handleError;
        audio.load();
      });

      audio.onended = () => {
        setIsPlaying(false);
        clearObjectUrl();
      };

      audio.onerror = (e) => {
        console.error('[WalkieTalkie] Playback error:', e);
        setIsPlaying(false);
        clearObjectUrl();
      };

      await audio.play();
      console.log('[WalkieTalkie] Playing audio from broadcast');
    } catch (err) {
      console.error('[WalkieTalkie] Play failed:', err);
      setIsPlaying(false);
      clearObjectUrl();
      toast({ title: 'Audio', description: 'Received message but could not play audio', variant: 'destructive' });
    }
  }, [clearObjectUrl, resolveAudioSource, toast]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'audio_message' }, (payload) => {
        const msg = payload.payload as AudioMessage;
        setLastMessage(msg);
        void playAudio(msg);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, playAudio]);

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
        stream.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size < 1000) return;

        const ext = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
        const fileName = `${Date.now()}-${deviceIdRef.current.slice(0, 8)}.${ext}`;

        const { error } = await supabase.storage
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

        const { data: signedData, error: signError } = await supabase.storage
          .from('walkie-talkie')
          .createSignedUrl(fileName, 300);

        if (signError) {
          console.warn('[WalkieTalkie] Signed URL fallback failed:', signError);
        }

        const message: AudioMessage = {
          id: crypto.randomUUID(),
          audioPath: fileName,
          audioUrl: signedData?.signedUrl,
          mimeType: mediaRecorder.mimeType,
          senderName: deviceName,
          senderId: deviceIdRef.current,
          timestamp: Date.now(),
        };

        channelRef.current?.send({
          type: 'broadcast',
          event: 'audio_message',
          payload: message,
        });
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
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