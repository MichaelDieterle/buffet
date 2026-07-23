module.exports = (sequelize, DataTypes) => {
  const Stock = sequelize.define('Stock', {
    symbol: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    sector: DataTypes.STRING,
    industry: DataTypes.STRING,
    currency: { type: DataTypes.STRING, defaultValue: 'USD' },
    marketCap: DataTypes.BIGINT,
    exchange: DataTypes.STRING,
    quoteType: DataTypes.STRING,
    shortName: DataTypes.STRING,
    longName: DataTypes.STRING,
    website: DataTypes.STRING,
    city: DataTypes.STRING,
    country: DataTypes.STRING,
    employees: DataTypes.INTEGER,
    businessSummary: DataTypes.TEXT,
    fiscalYearEnd: DataTypes.STRING,
    lastSyncedAt: DataTypes.DATE,
    isTracked: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { timestamps: true });

  Stock.associate = (models) => {
    Stock.hasMany(models.PriceHistory, { foreignKey: 'stockId', as: 'priceHistory' });
    Stock.hasMany(models.Competitor, { foreignKey: 'stockId', as: 'competitors' });
    Stock.hasMany(models.News, { foreignKey: 'stockId', as: 'news' });
    Stock.hasMany(models.Dividend, { foreignKey: 'stockId', as: 'dividends' });
    Stock.hasMany(models.Earning, { foreignKey: 'stockId', as: 'earnings' });
    Stock.hasMany(models.CalendarEvent, { foreignKey: 'stockId', as: 'calendarEvents' });
    Stock.hasMany(models.Fundamental, { foreignKey: 'stockId', as: 'fundamentals' });
    Stock.belongsToMany(models.Stock, { as: 'CompetedWith', through: models.Competitor, foreignKey: 'stockId', otherKey: 'competitorId' });
    Stock.belongsToMany(models.Comparison, { through: models.ComparisonItem, foreignKey: 'stockId' });
  };

  return Stock;
};
