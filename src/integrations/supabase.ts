import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'partner'
          full_name: string | null
          created_at: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'backlog' | 'in_progress' | 'review' | 'done'
          assigned_to: string | null
          priority: 'low' | 'medium' | 'high'
          due_date: string | null
          created_at: string
          updated_at: string
        }
      }
      financial_daily: {
        Row: {
          id: string
          date: string
          revenue_stripe: number
          revenue_kiwify: number
          refunds: number
          fees: number
          created_at: string
        }
      }
      decisions_log: {
        Row: {
          id: string
          decision: string
          reason: string
          decided_by: string
          decided_at: string
          result_observed: string | null
          created_at: string
        }
      }
      okrs: {
        Row: {
          id: string
          quarter: string
          category: 'revenue' | 'growth' | 'product' | 'operations'
          title: string
          target_value: number
          current_value: number
          created_at: string
        }
      }
      churn_metrics: {
        Row: {
          id: string
          date: string
          total_customers: number
          new_customers: number
          churned_customers: number
          churn_percentage: number
          ltv_estimated: number
          created_at: string
        }
      }
      youtube_daily: {
        Row: {
          id: string
          date: string
          channel_id: string
          subscribers: number
          total_views: number
          total_videos: number
          views_gained: number
          created_at: string
        }
      }
      youtube_videos: {
        Row: {
          id: string
          video_id: string
          title: string
          published_at: string
          view_count: number
          like_count: number
          comment_count: number
          thumbnail_url: string | null
          last_synced_at: string
          created_at: string
        }
      }
      instagram_daily: {
        Row: {
          id: string
          date: string
          account_id: string
          followers: number
          follows: number
          media_count: number
          reach: number
          impressions: number
          profile_views: number
          created_at: string
        }
      }
      instagram_posts: {
        Row: {
          id: string
          media_id: string
          media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL'
          caption: string | null
          permalink: string | null
          timestamp: string
          like_count: number
          comments_count: number
          reach: number
          impressions: number
          saves: number
          shares: number
          thumbnail_url: string | null
          last_synced_at: string
          created_at: string
        }
      }
      sync_log: {
        Row: {
          id: string
          service: 'stripe' | 'kiwify' | 'youtube' | 'instagram' | 'churn'
          status: 'running' | 'success' | 'error'
          records_processed: number
          error_message: string | null
          started_at: string
          completed_at: string | null
        }
      }
      revenue_transactions: {
        Row: {
          id: string
          date: string
          source: 'stripe' | 'kiwify'
          transaction_id: string
          product_name: string | null
          amount: number
          type: 'recurring' | 'annual' | 'one_time'
          status: string
          customer_email: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
      }
      monthly_expenses: {
        Row: {
          id: string
          month: string
          name: string
          description: string | null
          category: 'tool' | 'salary' | 'tax' | 'prolabore' | 'other'
          price_usd: number | null
          price_brl: number
          responsible: string | null
          is_recurring: boolean
          created_at: string
          updated_at: string
        }
      }
      systeme_tags: {
        Row: {
          id: string
          tag_id: number
          name: string
          contact_count: number
          last_synced_at: string
          created_at: string
        }
      }
      systeme_contacts_daily: {
        Row: {
          id: string
          date: string
          total_contacts: number
          new_contacts: number
          tag_breakdown: Record<string, number>
          created_at: string
        }
      }
      instagram_automations: {
        Row: {
          id: string
          media_id: string
          media_permalink: string | null
          media_caption: string | null
          media_thumbnail: string | null
          is_active: boolean
          keywords: string[]
          reply_comments: string[]
          dm_message: string | null
          dm_link: string | null
          dm_buttons: Array<{ url: string; title: string }>
          respond_to_all: boolean
          created_at: string
          updated_at: string
        }
      }
      instagram_processed_comments: {
        Row: {
          id: string
          comment_id: string
          automation_id: string
          commenter_username: string
          comment_text: string
          action_taken: string
          status: string
          error_message: string | null
          created_at: string
        }
      }
      ads_campaigns: {
        Row: {
          id: string
          campaign_id: string
          account_id: string
          name: string
          status: string
          objective: string | null
          daily_budget: number | null
          lifetime_budget: number | null
          impressions: number
          clicks: number
          reach: number
          spend: number
          cpc: number
          cpm: number
          ctr: number
          conversions: number
          cost_per_result: number
          created_time: string | null
          updated_time: string | null
          last_synced_at: string
          created_at: string
        }
      }
      ads_daily: {
        Row: {
          id: string
          date: string
          account_id: string
          total_spend: number
          total_impressions: number
          total_clicks: number
          total_reach: number
          total_conversions: number
          active_campaigns: number
          created_at: string
        }
      }
      human_agent_config: {
        Row: {
          id: string
          is_active: boolean
          agent_name: string
          system_prompt: string
          knowledge_base: string
          max_history_messages: number
          gemini_model: string
          created_at: string
          updated_at: string
        }
      }
      human_agent_conversations: {
        Row: {
          id: string
          ig_user_id: string
          ig_username: string | null
          status: string
          messages_count: number
          last_message_at: string
          created_at: string
        }
      }
      human_agent_messages: {
        Row: {
          id: string
          conversation_id: string
          ig_user_id: string
          direction: 'incoming' | 'outgoing'
          message_text: string
          ig_message_id: string | null
          status: string
          error_message: string | null
          created_at: string
        }
      }
    }
  }
}
