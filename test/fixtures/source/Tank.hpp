#pragma once
#include <string>
#include <vector>

#ifndef BREW_TANK_HPP
#define BREW_TANK_HPP

namespace brew::model {

/// Kinds of tank.
enum class TankType : int { Fermenter = 1, BrightTank };

enum Legacy { A, B = 2 };

struct Point { int x, y; };

/// A tank holding items of type T.
template <typename T>
class Tank : public Vessel, private Tracked<T> {
public:
    explicit Tank(int id);
    virtual ~Tank();
    static int count();
    const std::string& name() const;
    virtual void fill(int amount, double rate = 1.0) override;
    std::vector<T> items;

protected:
    int capacity = 100;

private:
    int m_id;
    T* m_current;
};

int freeFunction(const Point& p);

inline TankType defaultType() { return TankType::Fermenter; }

using TankList = std::vector<Tank<int>>;

} // namespace brew::model

#endif
