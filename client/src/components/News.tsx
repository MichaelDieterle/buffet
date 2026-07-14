import React from 'react';

interface NewsProps {
  news: { all: any[]; company: any[]; geopolitics: any[] }; // adjust types as needed
}

export const News: React.FC<NewsProps> = ({ news }) => {
  if (!news) return <div>Loading news...</div>;

  const { company, geopolitics } = news;

  return (
    <div className="news">
      <h3>Geopolitische Nachrichten</h3>
      {geopolitics.length === 0 ? <div className="muted">Keine</div> : (
        <>
          {geopolitics.map((item: any) => (
            <NewsCard key={item.uuid} item={item} type="geopolitics" />
          ))}
        </>
      )}
      <h3>Unternehmensnachrichten</h3>
      {company.length === 0 ? <div className="muted">Keine</div> : (
        <>
          {company.map((item: any) => (
            <NewsCard key={item.uuid} item={item} type="company" />
          ))}
        </>
      )}
    </div>
  );
};

interface NewsCardProps {
  item: any;
  type: 'company' | 'geopolitics';
}

const NewsCard: React.FC<NewsCardProps> = ({ item, type }) => {
  const isGeo = type === 'geopolitics';
  return (
    <a className={`news-card ${type}`} href={item.link} target="_blank" rel="noreferrer">
      {item.thumbnail && <img src={item.thumbnail} alt="" /> }
      <div className="news-body">
        <div className="news-title">{item.title}</div>
        <div className="news-meta">
          <span className={`tag tag-${type}`}>{isGeo ? 'Geopolitik' : 'Unternehmen'}</span>
          <span>{item.publisher}</span>
          <span className="muted">{new Date(item.publishedAt).toLocaleString()}</span>
        </div>
      </div>
    </a>
  );
};
