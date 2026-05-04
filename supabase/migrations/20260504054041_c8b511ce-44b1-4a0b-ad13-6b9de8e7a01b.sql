
-- Add length/format constraints to public-insert tracking tables
ALTER TABLE public.leads_clicks
  ADD CONSTRAINT leads_email_length CHECK (email IS NULL OR char_length(email) <= 254),
  ADD CONSTRAINT leads_phone_length CHECK (phone IS NULL OR char_length(phone) <= 32),
  ADD CONSTRAINT leads_name_length CHECK (name IS NULL OR char_length(name) <= 200),
  ADD CONSTRAINT leads_city_length CHECK (city IS NULL OR char_length(city) <= 120),
  ADD CONSTRAINT leads_state_length CHECK (state IS NULL OR char_length(state) <= 120),
  ADD CONSTRAINT leads_country_length CHECK (country IS NULL OR char_length(country) <= 120),
  ADD CONSTRAINT leads_zip_length CHECK (zip_code IS NULL OR char_length(zip_code) <= 32),
  ADD CONSTRAINT leads_ua_length CHECK (user_agent IS NULL OR char_length(user_agent) <= 1000),
  ADD CONSTRAINT leads_referrer_length CHECK (referrer IS NULL OR char_length(referrer) <= 2000),
  ADD CONSTRAINT leads_page_url_length CHECK (page_url IS NULL OR char_length(page_url) <= 2000),
  ADD CONSTRAINT leads_fingerprint_length CHECK (fingerprint IS NULL OR char_length(fingerprint) <= 128),
  ADD CONSTRAINT leads_ip_length CHECK (ip_address IS NULL OR char_length(ip_address) <= 64),
  ADD CONSTRAINT leads_utm_source_length CHECK (utm_source IS NULL OR char_length(utm_source) <= 200),
  ADD CONSTRAINT leads_utm_medium_length CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 200),
  ADD CONSTRAINT leads_utm_campaign_length CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 200),
  ADD CONSTRAINT leads_utm_content_length CHECK (utm_content IS NULL OR char_length(utm_content) <= 200),
  ADD CONSTRAINT leads_utm_term_length CHECK (utm_term IS NULL OR char_length(utm_term) <= 200);

ALTER TABLE public.cta_clicks
  ADD CONSTRAINT cta_button_text_length CHECK (button_text IS NULL OR char_length(button_text) <= 300),
  ADD CONSTRAINT cta_button_id_length CHECK (button_id IS NULL OR char_length(button_id) <= 200),
  ADD CONSTRAINT cta_page_url_length CHECK (page_url IS NULL OR char_length(page_url) <= 2000);
