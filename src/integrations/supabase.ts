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
          status: 'backlog' | 'todo' | 'doing' | 'blocked' | 'done'
          assigned_to: string | null
          priority: 'low' | 'medium' | 'high'
          due_date: string | null
          position: number
          done_at: string | null
          created_at: string
          updated_at: string
        }
      }
      meetings: {
        Row: {
          id: string
          title: string
          description: string | null
          meeting_date: string
          meeting_time: string
          duration_minutes: number
          location: string | null
          created_by: string | null
          recurring_weekly: boolean
          created_at: string
        }
      }
      meeting_participants: {
        Row: {
          id: string
          meeting_id: string
          participant_name: string
          created_at: string
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
          trigger_keywords: string[]
          require_keyword: boolean
          agent_type: 'support' | 'sales'
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
      ads_agent_actions: {
        Row: {
          id: string
          action_type: string
          campaign_id: string | null
          campaign_name: string | null
          source: string
          details: Record<string, unknown>
          status: string
          error_message: string | null
          platform: string
          created_at: string
        }
      }
      google_ads_campaigns: {
        Row: {
          id: string
          campaign_id: string
          customer_id: string
          name: string
          status: string
          campaign_type: string | null
          bidding_strategy: string | null
          daily_budget: number
          cost: number
          impressions: number
          clicks: number
          conversions: number
          cpc: number
          cpm: number
          ctr: number
          cost_per_conversion: number
          search_impression_share: number | null
          last_synced_at: string
          created_at: string
        }
      }
      google_ads_daily: {
        Row: {
          id: string
          date: string
          customer_id: string
          total_cost: number
          total_impressions: number
          total_clicks: number
          total_conversions: number
          active_campaigns: number
          created_at: string
        }
      }
      google_ads_config: {
        Row: {
          id: string
          customer_id: string | null
          client_id: string | null
          client_secret: string | null
          refresh_token: string | null
          developer_token: string | null
          is_connected: boolean
          last_token_refresh: string | null
          created_at: string
          updated_at: string
        }
      }
      ads_optimization_config: {
        Row: {
          id: string
          target_cpa: number
          min_roas: number
          min_daily_budget: number
          max_daily_budget: number
          budget_increase_pct: number
          budget_decrease_pct: number
          min_spend_to_evaluate: number
          min_impressions_to_evaluate: number
          max_cpa_multiplier: number
          pixel_id: string | null
          page_id: string | null
          auto_pause_enabled: boolean
          auto_boost_enabled: boolean
          optimizer_enabled: boolean
          updated_at: string
          created_at: string
        }
      }
      instagram_leads: {
        Row: {
          id: string
          username: string
          ig_user_id: string | null
          source: 'automation_comment' | 'dm' | 'manual'
          source_automation_id: string | null
          temperature: 'hot' | 'warm' | 'cold'
          temperature_override: boolean
          status: 'new' | 'contacted' | 'negotiating' | 'converted' | 'lost'
          interaction_count: number
          first_interaction_at: string
          last_interaction_at: string
          tags: string[]
          notes: string | null
          customer_email: string | null
          tracked_link_sent: boolean
          tracked_product_id: string | null
          converted_at: string | null
          conversion_value: number | null
          created_at: string
          updated_at: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price_brl: number
          payment_link: string
          payment_source: 'kiwify' | 'stripe'
          is_active: boolean
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
