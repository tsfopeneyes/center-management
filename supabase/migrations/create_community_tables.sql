


-- 4. RPC Functions for counts
CREATE OR REPLACE FUNCTION increment_post_likes(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_likes(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_post_comments(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_post_comments(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;
