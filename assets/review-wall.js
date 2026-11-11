const wall = document.querySelector('.review-wall');

async function showReviewNotes() {
  const endpoint = new URL('https://manscpjvvpiucefuovqk.supabase.co/rest/v1/wise_review_highlights');
  endpoint.search = new URLSearchParams({ select: 'excerpt', order: 'published_at.desc', limit: '8' });
  const response = await fetch(endpoint, {
    headers: { apikey: 'sb_publishable_cQJ-TkK4TIQUEaHu4OF5Kg_DCf5uMQe' },
    cache: 'no-store'
  });
  if (!response.ok) return;

  const excerpts = await response.json();
  if (!excerpts.length) return;

  const notes = excerpts.map(({ excerpt }) => {
    const note = document.createElement('li');
    note.textContent = excerpt;
    return note;
  });
  wall.querySelector('.review-notes').replaceChildren(...notes);
  wall.hidden = false;
}

showReviewNotes().catch(error => console.warn('수업 후기를 불러오지 못했습니다.', error));
