const wall = document.querySelector('.review-wall');

async function showReviewNotes() {
  const endpoint = new URL('https://manscpjvvpiucefuovqk.supabase.co/rest/v1/wise_review_highlights');
  endpoint.search = new URLSearchParams({ select: 'excerpt,rating,signature', order: 'published_at.desc', limit: '8' });
  const response = await fetch(endpoint, {
    headers: { apikey: 'sb_publishable_cQJ-TkK4TIQUEaHu4OF5Kg_DCf5uMQe' },
    cache: 'no-store'
  });
  if (!response.ok) return;

  const excerpts = await response.json();
  if (!excerpts.length) return;

  const notes = excerpts.map(({ excerpt, rating, signature }) => {
    const note = document.createElement('li');

    const stars = document.createElement('span');
    stars.className = 'review-note-rating';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', '별점 5점 만점에 ' + rating + '점');
    stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    const quote = document.createElement('p');
    quote.className = 'review-note-quote';
    quote.textContent = excerpt;

    const author = document.createElement('span');
    author.className = 'review-note-signature';
    author.textContent = '– ' + signature;

    note.append(stars, quote, author);
    return note;
  });
  wall.querySelector('.review-notes').replaceChildren(...notes);
  wall.hidden = false;
}

showReviewNotes().catch(error => console.warn('수업 후기를 불러오지 못했습니다.', error));
