import axios from 'axios';

export interface TavusConversation {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

export class TavusService {
  private apiKey: string;
  private replicaId: string;
  private baseUrl = 'https://tavusapi.com/v2/conversations';
  private videoUrl = 'https://tavusapi.com/v2/videos';

  constructor() {
    this.apiKey = process.env.TAVUS_API_KEY || '';
    this.replicaId = process.env.TAVUS_REPLICA_ID || 'r87e86419bb2';
    
    if (!this.apiKey) {
      console.warn('TAVUS_API_KEY is not set in environment variables.');
    }
  }

  getReplicaId(): string {
    return this.replicaId;
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.replicaId);
  }

  async createConversation(userName: string = 'User'): Promise<TavusConversation> {
    if (!this.isConfigured()) {
      throw new Error('Tavus API is not configured');
    }

    console.log(`Creating Tavus conversation with Replica: ${this.replicaId}`);
    
    const payload: any = {
      replica_id: this.replicaId,
      conversation_name: `Conversation with ${userName}`,
      conversational_context: "You are Pietro Sella, CEO of Gruppo Sella. You are having a strategic conversation with a business partner. Respond in a professional, executive tone. Use Italian as the primary language but understand English.",
      custom_greeting: "Buongiorno. Sono Pietro Sella. Iniziamo pure il nostro confronto strategico. Di cosa vorrebbe discutere oggi?",
      properties: {
        max_call_duration: 3600,
        participant_left_timeout: 60
      }
    };

    try {
      const response = await axios.post(
        this.baseUrl,
        payload,
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        conversation_id: response.data.conversation_id,
        conversation_url: response.data.conversation_url,
        status: response.data.status
      };
    } catch (error: any) {
      let errorMessage = 'Failed to create Tavus conversation';
      const responseData = error.response?.data;
      const responseMessage = responseData?.message || '';
      const axiosMessage = error.message || '';
      
      console.error('Tavus createConversation full error:', {
        status: error.response?.status,
        data: responseData,
        message: axiosMessage
      });
      
      const isCreditError = 
        responseMessage.toLowerCase().includes('credits') || 
        axiosMessage.toLowerCase().includes('credits') ||
        responseMessage.toLowerCase().includes('quota') ||
        axiosMessage.toLowerCase().includes('quota');
      
      if (responseData && responseMessage) {
        errorMessage = responseMessage;
      } else if (error.response?.status === 400) {
        errorMessage = `Tavus API 400 Error: ${JSON.stringify(responseData || axiosMessage)}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  async getConversationStatus(conversationId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/${conversationId}`, {
        headers: { 'x-api-key': this.apiKey }
      });
      return response.data;
    } catch (error: any) {
      console.error('Tavus getStatus error:', error.response?.data || error.message);
      throw new Error('Failed to get Tavus conversation status');
    }
  }

  async stopConversation(conversationId: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/${conversationId}/end`, {}, {
        headers: { 'x-api-key': this.apiKey }
      });
    } catch (error: any) {
      console.error('Tavus stopConversation error:', error.response?.data || error.message);
    }
  }

  async listConversations(): Promise<any[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: { 'x-api-key': this.apiKey }
      });
      return response.data.conversations || [];
    } catch (error: any) {
      console.error('Tavus listConversations error:', error.response?.data || error.message);
      return [];
    }
  }

  async stopAllConversations(): Promise<void> {
    const conversations = await this.listConversations();
    // Stop anything that isn't already ended or failed
    const activeConversations = conversations.filter(c => 
      c.status !== 'ended' && 
      c.status !== 'failed' && 
      c.status !== 'error'
    );
    
    console.log(`Cleanup: Found ${activeConversations.length} non-terminal Tavus conversations out of ${conversations.length} total.`);
    
    if (activeConversations.length === 0) return;

    // Stop them in parallel for speed
    await Promise.allSettled(activeConversations.map(async (conv) => {
      try {
        await this.stopConversation(conv.conversation_id);
        console.log(`Cleanup: Successfully requested end for ${conv.conversation_id}`);
      } catch (e) {
        console.error(`Cleanup: Failed to stop ${conv.conversation_id}:`, e);
      }
    }));
  }

  async sendComment(conversationId: string, text: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/${conversationId}/comment`, { text }, {
        headers: { 'x-api-key': this.apiKey }
      });
    } catch (error: any) {
      console.error('Tavus sendComment error:', error.response?.data || error.message);
    }
  }
}

export const tavusService = new TavusService();
